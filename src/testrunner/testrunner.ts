import isEqual from 'lodash.isequal';
import fs from 'fs';
import { promises as fsp } from 'fs';
import pathlib from 'path';
import util from 'util';
import assert from 'assert';
import { EventEmitter } from 'events';
import mkdirp from 'mkdirp';
const mkdirpAsync = util.promisify(mkdirp);
import { Bitmap } from '../../modules/pnglib/pnglib';
import glob from 'glob';
const globAsync = util.promisify(glob);
import bufferImageDiff, { ImageDiffResult } from '../../modules/buffer-image-diff/image-diff';
import unsafePrettyMs from 'pretty-ms';
import delay from '../../modules/delay/delay';
import type { IBrowser } from '../../modules/browsers/browser-interface';
import type { ImageDiffOptions } from '../../modules/buffer-image-diff/image-diff';
import { logger, ChildLogger } from '../logging/logger';
import callsites from 'callsites';

const TEST_STATE = {
    SCHEDULED: 'scheduled',
    PASSED: 'passed',
    FAILED: 'failed',
} as const;

type TestState = typeof TEST_STATE[keyof typeof TEST_STATE];

const DEFAULT_TEST_NAME = '(Unnamed test)';

const ELLIPSIS_LIMIT = 40;

const DEFAULT_SUITE_NAME = '(Unnamed suite)';

const DEFAULT_REF_SCREENSHOTS_DIR = 'reference-screenshots';
const DEFAULT_REF_ERRORS_DIR = 'reference-errors';
const DEFAULT_REF_DIFFS_DIR = 'reference-diffs';

const REPORT_FILE_NAME = 'test-run-report.json';

class AssertError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AssertError';
    }
}

class AbortError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'AbortError';
    }
}

class TestFailedError extends Error {
    testErrors: Error[] | null

    constructor({ message, testErrors = null }: { message: string, testErrors?: Error[] | null}) {
        super(message);
        this.testErrors = testErrors || [];
        this.name = 'TestFailedError';
    }
}

class BailoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BailoutError';
    }
}

class TestBailoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TestBailoutError';
    }
}

/**
 * test assert API (without before/after side effects, "directAPI")
 */
interface TestAssertAPIDirect {
    getValue: Testrunner['_getValueDirect']
    setValue: Testrunner['_setValueDirect']
    setFileInput: Testrunner['_setFileInputDirect']
    click: Testrunner['_clickDirect']
    waitForVisible: Testrunner['_waitForVisibleDirect']
    waitWhileVisible: Testrunner['_waitWhileVisibleDirect']
    isVisible: Testrunner['_isVisibleDirect']
    focus: Testrunner['_focusDirect']
    scroll: Testrunner['_scrollDirect']
    scrollTo: Testrunner['_scrollToDirect']
    delay: Testrunner['_delay']
    comment: Testrunner['_comment']
    /** @deprecated Use screenshot instead */
    assert: Testrunner['_screenshot']
    screenshot: Testrunner['_screenshot']
    pressKey: Testrunner['_pressKeyDirect']
    mouseover: Testrunner['_mouseoverDirect']
    execFunction: Testrunner['_execFunctionDirect']
    execCommands: Testrunner['_execCommandsDirect']
}

interface BeforeAfterCommandCallback {
    (t: TestAssertAPIDirect, command?: { type: Command['type'] }): Promise<void>
}

interface DirectAPICallback {
    (t: TestAssertAPIDirect): Promise<void>
}

interface TestrunnerCallback {
    (testrunner: Testrunner): Promise<void>
}

export interface Suite {
    name: string
    appUrl: string
    /** relative/absolute paths and/or globs */
    testFiles?: string[]
    tests?: Test[]
    beforeSuite?: Function
    afterSuite?: Function
    beforeTest?: Function
    afterTest?: Function
    beforeCommand?: BeforeAfterCommandCallback
    beforeFirstCommand?: BeforeAfterCommandCallback
    afterCommand?: BeforeAfterCommandCallback
    afterLastCommand?: DirectAPICallback
    beforeAssert?: DirectAPICallback
    afterAssert?: DirectAPICallback
}

interface Test {
    name: string
    id: string
    testFn: TestFn
    state?: TestState
    runErrors?: Error[]
}

export interface TestFn {
    (t: TestAPI, options: { suite: Suite, directAPI: TestAssertAPIDirect, browser: IBrowser }): Promise<void>
}

interface screenshotItem {
    errorImage: { path: string, relativePath: string }
    diffImage: { path: string, relativePath: string }
    referenceImage: { path: string, relativePath: string }
    attempt: number
    assertIndex: number
    testName: string
}

export interface TestRunReport {
    screenshots: screenshotItem[]
    testsCount: number | null
    passedCount: number | null
    failedCount: number | null
    failedTestNames: string[]
    runTimeMs: number | null
    runtimes: Record<string, number>
    passed: boolean
}

type Level = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

export interface TestrunnerConfig {
    fileLogLevel: Level,
    consoleLogLevel:  Level, 
    /** Bailout from a single test if an assert fails */
    testBailout: boolean
    /** Bailout from the entire test program if an assert fails */
    bailout: boolean
    referenceScreenshotsDir: string
    referenceErrorsDir: string
    referenceDiffsDir: string
    workspaceDir: string
    browsers: IBrowser[]
    /** options for the built-in, screenshot-based asserter */
    imageDiffOptions: ImageDiffOptions
    suites: Suite[]
    assertRetryCount: number
    assertRetryInterval: number
    /** regular expression string */
    testFilter: string
    outStream: import('stream').Writable
    /** retry failed tests n times */
    testRetryCount: number
    /** retry failed tests only if test name matches this filter */
    testRetryFilter: RegExp
    commandRetryCount: number
    commandRetryInterval: number
    onCommandError: TestrunnerCallback
    onAssertError: TestrunnerCallback
    exitTimeout: number
}


interface TestAPI extends TestAssertAPIDirect {
    equal: Testrunner['_equal']
    equals: Testrunner['_equal']
}

interface Command {
    type: keyof TestAssertAPIDirect;
    selector: string;
    value?: any;
    pollInterval?: number;
    timeout?: number;
    initialDelay?: number;
}

class Testrunner extends EventEmitter {
    private _conf: TestrunnerConfig;
    private _log: ChildLogger;
    private _isRunning: boolean;
    private _isAborting: boolean;
    private _assertCount: number;
    private _foundTestsCount: number;
    private _okTestsCount: number;
    private _testRunReport: TestRunReport;
    private _currentTest: any;
    private _currentBeforeCommand: BeforeAfterCommandCallback | null;
    private _currentAfterCommand: BeforeAfterCommandCallback | null;
    private _currentBeforeAssert: DirectAPICallback | null;
    private _currentAfterAssert: DirectAPICallback | null;
    private _currentBrowser: IBrowser | null;

    directAPI: TestAssertAPIDirect;
    sideEffectAPI: TestAssertAPIDirect;
    tAPI: TestAPI;

    static AbortError = AbortError;
    static AssertError = AssertError;

    constructor(conf: Partial<TestrunnerConfig>) {
        super();

        const defaultConf = {
            fileLogLevel: 'debug',
            consoleLogLevel: 'info',
            testBailout: true,
            bailout: false,
            referenceScreenshotsDir: DEFAULT_REF_SCREENSHOTS_DIR,
            referenceErrorsDir: DEFAULT_REF_ERRORS_DIR,
            referenceDiffsDir: DEFAULT_REF_DIFFS_DIR,
            workspaceDir: process.cwd(),
            browsers: [],
            suites: [],
            testFilter: null, // TODO use regex instead of string
            outStream: process.stdout,
            assertRetryCount: 0,
            assertRetryInterval: 1000,
            testRetryCount: 0,
            testRetryFilter: /.+/,
            onCommandError: null,
            onAssertError: null,
            commandRetryCount: 4,
            commandRetryInterval: 250,
            exitTimeout: 5 * 60000,
            imageDiffOptions: {},
        };

        const defaultImageDiffOptions = {
            colorThreshold: 3,
            imageThreshold: 20,
            includeDiffBufferIndexes: true,
        };

        for (const key of Reflect.ownKeys(conf)) {
            if (conf[key as keyof TestrunnerConfig] === undefined) {
                delete conf[key as keyof TestrunnerConfig];
            }
        }

        this._conf = Object.assign(defaultConf, conf);
        this._conf.imageDiffOptions = Object.assign({}, defaultImageDiffOptions, conf.imageDiffOptions);

        const logFilePath = pathlib.resolve(this._conf.workspaceDir, 'run.log');
        logger.init(this._conf.consoleLogLevel, this._conf.fileLogLevel, logFilePath);
        this._log = logger.childLogger('Testrunner');

        // check for configs not in defaultConf
        const confKeys = Object.keys(conf);
        const unknownKeys = confKeys.filter(key => !(key in defaultConf));

        if (unknownKeys.length > 0) {
            this._log.warn(`unknown config keys: ${unknownKeys.join(', ')}`);
        }


        this._currentBeforeCommand = null;
        this._currentAfterCommand = null;

        this._currentBeforeAssert = null;
        this._currentAfterAssert = null;

        this._isRunning = false;
        this._isAborting = false;

        // -------------------

        // TODO ensure browser names are unique (for reference images)

        // const validationResult = Schema.validate(CONF_SCHEMA, this._conf);

        // if (!validationResult.valid) {
        //     this._log.debug('conf validation failed');
        //     throw new Error(validationResult.format());
        // }

        // -------------------

        if (!Array.isArray(this._conf.browsers)) {
            this._conf.browsers = [this._conf.browsers];
        }

        this.directAPI = {
            getValue: this._getValueDirect.bind(this),
            setValue: this._setValueDirect.bind(this),
            setFileInput: this._setFileInputDirect.bind(this),
            click: this._clickDirect.bind(this),
            waitForVisible: this._waitForVisibleDirect.bind(this),
            waitWhileVisible: this._waitWhileVisibleDirect.bind(this),
            isVisible: this._isVisibleDirect.bind(this),
            focus: this._focusDirect.bind(this),
            scroll: this._scrollDirect.bind(this),
            scrollTo: this._scrollToDirect.bind(this),
            delay: this._delay.bind(this),
            comment: this._comment.bind(this),
            assert: this._screenshot.bind(this),
            screenshot: this._screenshot.bind(this),
            pressKey: this._pressKeyDirect.bind(this),
            mouseover: this._mouseoverDirect.bind(this),
            execFunction: this._execFunctionDirect.bind(this),
        } as TestAssertAPIDirect;

        this.sideEffectAPI = {} as TestAssertAPIDirect;

        Object.keys(this.directAPI).forEach(key => {
            if (/delay|comment/.test(key)) {
                return;
            }
            const directAPIFn = this.directAPI[key as keyof TestAssertAPIDirect];
            this.sideEffectAPI[key as keyof TestAssertAPIDirect] = this._wrapFunctionWithSideEffects(directAPIFn, key as keyof TestAssertAPIDirect);
        });

        this.sideEffectAPI.delay = this.directAPI.delay;
        this.sideEffectAPI.comment = this.directAPI.comment;

        this.directAPI.execCommands = this._execCommandsDirect.bind(this);
        this.sideEffectAPI.execCommands = this._execCommandsSideEffect.bind(this);

        this.tAPI = Object.assign({}, this.sideEffectAPI, {
            equal: this._equal.bind(this),
            equals: this._equal.bind(this),
        });

        this._assertCount = 0;

        this._currentBrowser = null;
        this._foundTestsCount = 0;
        this._okTestsCount = 0;

        this._testRunReport = {
            screenshots: [],
            failedCount: null,
            failedTestNames: [],
            testsCount: null,
            passedCount: null,
            passed: false,
            runTimeMs: null,
            runtimes: {},
        };
    }

    async run() {
        const conf = this._conf;
        const runStartTime = Date.now();

        if (this._isRunning) {
            throw new Error('Testrunner.run(): already running');
        }

        this._isRunning = true;

        try {
            if (conf.suites.length === 0) {
                throw new Error('No test suites specified');
            }

            await this._parseSuiteTestfiles();
            this._foundTestsCount = conf.suites.reduce((accum, suite) => accum + suite.tests.length, 0);

            // TODO move to function
            // region test count info
            let testCountInfo = `found ${this._foundTestsCount} tests`;

            if (conf.browsers.length > 1) {
                testCountInfo += ` for ${conf.browsers.length} browsers`;
            }

            if (conf.testFilter) {
                testCountInfo += ` (using filter "${conf.testFilter}")`;
            }

            // endregion
            this._log.info(testCountInfo);

            await this._runBrowsers();
        }
        catch (error) {
            process.exitCode = 1;
            this._log.error(error);
        }
        finally {
            // TODO run time, TAP msg
            this._log.info(`Finished in ${prettyMs(Date.now() - runStartTime, { verbose: true })}`);

            const effectiveTestsCount = this._foundTestsCount * this._conf.browsers.length;

            this._log.info(`Tests: ${effectiveTestsCount}`);
            this._log.info(`Pass: ${this._okTestsCount}`);

            const failedTestNames: string[] = [];

            if (effectiveTestsCount !== this._okTestsCount) {
                process.exitCode = 1;

                conf.suites.forEach(suite => {
                    suite.tests.forEach(test => {
                        if (test.state === TEST_STATE.FAILED && !failedTestNames.includes(test.name)) {
                            failedTestNames.push(test.name);
                        }
                    });
                });

                this._log.warn('---');
                failedTestNames.forEach(name => this._log.warn('[FAIL] ' + name));
                this._log.warn('---');
                this._log.warn('FAILURE');
            }
            else {
                this._log.info('SUCCESS');
            }

            this._testRunReport.testsCount = effectiveTestsCount;
            this._testRunReport.passedCount = this._okTestsCount;
            this._testRunReport.failedCount = this._testRunReport.testsCount - this._testRunReport.passedCount;
            this._testRunReport.passed = this._testRunReport.testsCount === this._testRunReport.passedCount;
            this._testRunReport.runTimeMs = Date.now() - runStartTime;
            this._testRunReport.failedTestNames = failedTestNames;

            try {
                // TODO deprecated, remove in future
                await fsp.writeFile(pathlib.resolve(this._conf.workspaceDir, 'screenshot-catalog.json'), JSON.stringify(this._testRunReport.screenshots, null, 4));

                await fsp.writeFile(pathlib.resolve(this._conf.workspaceDir, REPORT_FILE_NAME), JSON.stringify(this._testRunReport, null, 4));
            }
            catch (err) {
                console.error(err);
            }

            this._isRunning = false;

            this._startExitTimeout();
        }
    }

    async abort() {
        if (!this._isRunning) {
            throw new Error('Testrunner.abort(): not running');
        }

        if (this._isAborting) {
            throw new Error('Testrunner.abort(): already aborting');
        }

        this._isAborting = true;
        this._log.info('aborting...');

        while (this._isRunning) {
            await delay(500);
        }

        this._isAborting = false;
        this._log.info('aborted!');
    }

    isRunning() {
        return this._isRunning;
    }

    private async _runBrowsers() {
        const conf = this._conf;

        for (const browser of conf.browsers) {
            this._currentBrowser = browser;

            if (this._isAborting) {
                throw new AbortError();
            }

            await this._runSuites();
        }
    }

    private async _runSuites() {
        const conf = this._conf;

        for (const suite of conf.suites) {
            if (this._isAborting) {
                throw new AbortError();
            }

            try {
                if (suite.beforeSuite) {
                    this._log.debug('running beforeSuite');
                    await suite.beforeSuite();
                    this._log.debug('completed beforeSuite');
                }

                await this._runSuite(suite);
            }
            finally {
                if (suite.afterSuite) {
                    this._log.debug('running afterSuite');

                    try {
                        await suite.afterSuite();
                        this._log.debug('completed afterSuite');
                    }
                    catch (error) {
                        this._log.error(error);
                    }
                }
            }
        }
    }

    private async _runSuite(suite: Suite) {
        this._log.verbose(`running suite: ${suite.name || DEFAULT_SUITE_NAME}`);

        for (const test of suite.tests) {
            if (this._isAborting) {
                throw new AbortError();
            }

            try {
                this._log.verbose(test.name);
                await this._runTestWithRetries({ suite, test });
                this._log.verbose(`${test.name} (${prettyMs(this._testRunReport.runtimes[test.name])})`);
                this._okTestsCount++;
            }
            catch (error) {
                this._log.warn(`${test.name} (${prettyMs(this._testRunReport.runtimes[test.name])})`);
                this._log.warn(error);
            }
        }
    }

    private async _runTestWithRetries({ suite, test }: { suite: Suite, test: Test }) {
        this._log.verbose(`_runTestWithRetries: started for test: '${test.name}'`);

        const maxAttempts = this._conf.testRetryFilter.test(test.name) ? this._conf.testRetryCount + 1 : 1;

        this._log.verbose(`_runTestWithRetries: maxAttempts = ${maxAttempts}`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this._log.verbose(`_runTestWithRetries loop: attempt = ${attempt}`);

            try {
                await this._runTest({ suite, test });

                // cleanup: remove potential failed screenshots from catalog for this test
                // TODO delete screenshots from disk? or don't write them until test fails
                this._testRunReport.screenshots = this._testRunReport.screenshots.filter(screenshotItem => screenshotItem.testName !== test.name);

                this._log.verbose(`_runTestWithRetries: success, test '${test.name}' passed`);
                break;
            }
            catch (error) {
                this._log.debug('_runTestWithRetries: error when running _runTest:');
                this._log.debug(error);

                if (attempt === maxAttempts) {
                    throw error;
                }

                this._log.verbose(`test "${test.name}" failed, retrying`);

                if (error.testErrors && error.testErrors.length > 0) {
                    this._log.debug(error.testErrors.map(String).join('\n'));
                }
            }
        }
    }

    private async _runTest({ suite, test }: { suite: Suite, test: Test }) {
        this._log.verbose(`_runTest: running test ${test.name}`);

        const browser = this._currentBrowser;

        this._log.verbose(`starting browser "${browser.name}"`);
        try {
            await browser.start();
            this._log.verbose(`started browser "${browser.name}"`);
        }
        catch (error) {
            this._log.error(`browser "${browser.name}" failed to start`);
            throw error;
        }

        try {
            if (suite.beforeTest) {
                this._log.debug('running beforeTest');
                await suite.beforeTest(this.directAPI);
                this._log.debug('completed beforeTest');
            }

            await this._runTestCore({ suite, test });
        }
        finally {
            if (suite.afterTest) {
                this._log.debug('running afterTest');

                try {
                    await suite.afterTest(this.directAPI, { test });
                }
                catch (error) {
                    this._log.error(error);
                }

                this._log.debug('completed afterTest');
            }

            try {
                await browser.stop();
            }
            catch (error) {
                this._log.error(error);
            }
        }
    }

    private async _runTestCore({ suite, test }: { suite: Suite, test: Test }) {
        this._log.verbose(`_runTestCore: running test ${test.name}`);

        this._currentTest = test;
        this._assertCount = 0;

        test.runErrors = [];
        test.state = TEST_STATE.SCHEDULED;

        let testStartTime = 0;

        await this._currentBrowser.navigateTo(suite.appUrl);

        if (suite.beforeFirstCommand) {
            await suite.beforeFirstCommand(this.directAPI);
        }

        this._currentBeforeCommand = suite.beforeCommand || null;
        this._currentAfterCommand = suite.afterCommand || null;
        this._currentBeforeAssert = suite.beforeAssert || null;
        this._currentAfterAssert = suite.afterAssert || null;

        try {
            testStartTime = Date.now();

            await test.testFn(this.tAPI, { suite: suite, directAPI: this.directAPI, browser: this._currentBrowser });

            if (test.runErrors.length > 0) {
                throw new TestFailedError({
                    message: `Test "${test.name}" failed`,
                    testErrors: test.runErrors,
                });
            }

            this._testRunReport.runtimes[test.name] = Date.now() - testStartTime;

            test.state = TEST_STATE.PASSED;
        }
        catch (error) {
            this._testRunReport.runtimes[test.name] = Date.now() - testStartTime;

            test.state = TEST_STATE.FAILED;
            throw error;
        }
        finally {
            if (suite.afterLastCommand) {
                await suite.afterLastCommand(this.directAPI);
            }
        }
    }

    private async _parseSuiteTestfiles() {
        const conf = this._conf;

        for (const suite of conf.suites) {
            suite.tests = await this._parseTestFiles(await multiGlobAsync(suite.testFiles));

            if (conf.testFilter !== null) {
                const filterRegex = new RegExp(conf.testFilter, 'i');

                suite.tests = suite.tests.filter(test => filterRegex.test(test.name));
            }
        }

        conf.suites = conf.suites.filter(suite => suite.tests.length > 0);
    }

    private async _parseTestFiles(testFilePaths: string[]) {
        const tests: Test[] = [];

        function testRegistrar(arg0: TestFn): void;
        function testRegistrar(arg0: string, arg1: TestFn): void;
        function testRegistrar(arg0: TestFn | string, arg1?: TestFn): void {
            let name: string;
            let testFn: TestFn;

            if (arg1 === undefined) {
                assert(typeof arg0 === 'function');
                name = DEFAULT_TEST_NAME;
                testFn = arg0;
            }
            else {
                assert(typeof arg0 === 'string');
                name = arg0;
                testFn = arg1;
            }

            let id = getIdFromName(name);
            const idCount = tests.filter(t => t.id === id).length;

            if (idCount > 0) {
                id += `_(${idCount + 1})`;
            }

            tests.push({
                id: id,
                name: name,
                testFn: testFn,
            });
        }

        for (const path of testFilePaths) {
            const absPath = pathlib.resolve(path);

            require(absPath)(testRegistrar, this);
        }

        return tests;
    }

    private _wrapFunctionWithSideEffects(fn: Function, cmdType: keyof TestAssertAPIDirect) {
        return async (...args: any[]) => {
            if (this._isAborting) {
                throw new AbortError();
            }

            if (this._currentBeforeCommand) {
                await this._currentBeforeCommand(this.directAPI, { type: cmdType });
            }
            const fnResult = await fn(...args);
            if (this._currentAfterCommand) {
                await this._currentAfterCommand(this.directAPI, { type: cmdType });
            }
            return fnResult;
        };
    }

    private async _execCommandWithAPI(cmd: Command, api: TestAssertAPIDirect) {
        switch (cmd.type) {
            case 'setValue': return api.setValue(cmd.selector, cmd.value);
            case 'click': return api.click(cmd.selector);
            case 'waitForVisible': return api.waitForVisible(cmd.selector, { pollInterval: cmd.pollInterval, timeout: cmd.timeout });
            case 'waitWhileVisible': return api.waitWhileVisible(cmd.selector, {
                pollInterval: cmd.pollInterval, timeout: cmd.timeout, initialDelay: cmd.initialDelay,
            });
            case 'focus': return api.focus(cmd.selector);
            case 'assert': return api.assert();
                // case 'scroll': return api.()
                // TODO missing commands
            default: throw new Error(`Unknown cmd.type ${cmd.type}`);
        }
    }

    private async _execCommandDirect(cmd: Command) {
        return this._execCommandWithAPI(cmd, this.directAPI);
    }

    private async _execCommandSideEffect(cmd: Command) {
        return this._execCommandWithAPI(cmd, this.sideEffectAPI);
    }

    private async _execCommandsDirect(cmds: Command[]) {
        for (const cmd of cmds) {
            await this._execCommandDirect(cmd);
        }
    }

    private async _execCommandsSideEffect(cmds: Command[]) {
        for (const cmd of cmds) {
            await this._execCommandSideEffect(cmd);
        }
    }

    private async _runBrowserCommandWithRetries(browserFnName: string | Function, args: any[], callsite: string) {
        let retries = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this._log.verbose(`_execCommandWithRetries - attempt: ${retries}, command: ${browserFnName}, args: ${util.inspect(args)}`);

            try {
                if (typeof browserFnName === 'function') {
                    await browserFnName();
                }
                else {
                    await this._currentBrowser[browserFnName](...args);
                }

                this._log.verbose('_execCommandWithRetries - success');
                break;
            }
            catch (err) {
                if (retries < this._conf.commandRetryCount) {

                    if (typeof browserFnName === 'string') {
                        this._log.verbose(`command error, retrying "${browserFnName}" at ${callsite}`);
                    }
                    else {
                        this._log.verbose(`command error, retrying at ${callsite}`);
                    }

                    this._log.verbose(err);
                    retries++;
                    await delay(this._conf.commandRetryInterval);
                    continue;
                }

                this._log.verbose('_execCommandWithRetries - failure, max retries reached');

                throw err;
            }
        }
    }

    private _equal(actual: unknown, expected: unknown, description: string) {
        if (isEqual(actual, expected)) {
            this._log.info('equal OK: ' + (description || '(unnamed)'));
            // this._tapWriter.ok({
            //     type: 'equal',
            //     message: description,
            // });
        }
        else {
            this._log.error('equal FAIL: ' + (description || '(unnamed)'));
            throw new Error(`Testrunner._equal: FAIL (actual: ${actual}, expected: ${expected}, description: ${description || '(none)'})`);
            // this._tapWriter.fail({
            //     type: 'equal',
            //     expected: expected,
            //     actual: actual,
            // });

        }
    }

    private async _clickDirect(selector: string/* , options*/) {
        this._log.verbose(`click: "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._runBrowserCommandWithRetries('click', [selector], callsite);
        }
        catch (err) {
            await this._handleCommandError(err, 'click', callsite);
        }
    }

    private async _getValueDirect(selector: string) {
        this._log.verbose(`getValue: "${ellipsis(selector)}"`);

        return this._currentBrowser.getValue(selector);
    }

    private async _setValueDirect(selector: string, value: string) {
        this._log.verbose(`setValue: "${ellipsis(value)}", "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._runBrowserCommandWithRetries(async () => {
                // @ts-expect-error
                await this._currentBrowser.execFunction((s) => document.querySelector(s).select(), selector);
                await this._currentBrowser.type(selector, value);
            }, [], callsite);
        }
        catch (err) {
            await this._handleCommandError(err, 'setValue', callsite);
        }
    }

    private async _setFileInputDirect(selector: string, filePath: string, options?: { waitForVisible?: boolean, checkSelectorType?: boolean }) {
        this._log.verbose(`setFileInput: "${selector}", "${filePath}"`);

        const callsite = getCallSiteForDirectAPI();

        const opts = { ...{ waitForVisible: true, checkSelectorType: true }, ...options };

        try {
            await this._runBrowserCommandWithRetries(async () => {
                if (opts.waitForVisible) {
                    await this._currentBrowser.waitForVisible(selector);
                }

                if (opts.checkSelectorType) {
                    const isFileInput = await this._currentBrowser.execFunction((s: Function) => {
                        // @ts-expect-error
                        const node = document.querySelector(s);
                        return Boolean(node && node.tagName.toLowerCase() === 'input' && node.type.toLowerCase() === 'file');
                    }, selector);

                    if (!isFileInput) {
                        throw new Error(`setFileInput failure: selector is not a file input: "${selector}"`);
                    }
                }

                // @ts-expect-error FIXME implementation leak, don't use _page, maybe move setFileInput to BrowserInterface
                const fileChooserPromise = this._currentBrowser._page.waitForFileChooser();
                await this._currentBrowser.click(selector);
                await (await fileChooserPromise).accept([filePath]);
            }, [], callsite);
        }
        catch (err) {
            await this._handleCommandError(err, 'setFileInput', callsite);
        }
    }

    /**
     * @param keyCode See https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts
     */
    private async _pressKeyDirect(keyCode: string) {
        this._log.verbose(`pressKey: ${keyCode}`);

        const callsite = getCallSiteForDirectAPI();

        if (arguments.length > 1) {
            throw new TypeError('Selector is removed, pressKey only accepts keyCode.');
        }

        if (typeof keyCode !== 'string') {
            throw new TypeError('Expected string keyCode');
        }

        await this._runBrowserCommandWithRetries('pressKey', [keyCode], callsite);
    }

    private async _waitForVisibleDirect(selector: string, opts = {}) {
        this._log.verbose(`waitForVisible: "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._currentBrowser.waitForVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitForVisible', callsite);
        }
    }

    private async _waitWhileVisibleDirect(selector: string, opts = {}) {
        this._log.verbose(`waitWhileVisible: "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._currentBrowser.waitWhileVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitWhileVisible', callsite);
        }
    }

    private async _isVisibleDirect(selector: string) {
        this._log.verbose(`isVisible: "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            const result = await this._currentBrowser.isVisible(selector);
            return result;
        }
        catch (err) {
            await this._handleCommandError(err, 'isVisible', callsite);
        }
    }

    private async _focusDirect(selector: string /* , options*/) {
        this._log.verbose(`focus: "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.focus(selector);
        }
        catch (err) {
            // TODO handle as error?
            this._log.warn(`WARNING - focus failed - ${err.message}`);
        }
    }

    private async _scrollDirect(selector: string, scrollTop: number) {
        this._log.verbose(`scroll: ${scrollTop}, "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._currentBrowser.scroll(selector, scrollTop);
        }
        catch (err) {
            await this._handleCommandError(err, 'scroll', callsite);
        }
    }

    private async _scrollToDirect(selector: string) {
        this._log.verbose(`scrollTo: "${ellipsis(selector)}"`);

        const callsite = getCallSiteForDirectAPI();

        try {
            await this._currentBrowser.scrollIntoView(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'scrollTo', callsite);
        }
    }

    private async _mouseoverDirect(selector: string) {
        this._log.verbose(`mouseover: ${selector}`);

        const callsite = getCallSiteForDirectAPI();

        try {
            this._currentBrowser.hover(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'mouseover', callsite);
        }
    }

    private async _execFunctionDirect(fn: Function, ...args: any[]) {
        this._log.verbose(`execFunction: ${fn.name || '(anonymous)'}`);

        return this._currentBrowser.execFunction(fn, ...args);
    }

    private async _delay(ms: number) {
        this._log.verbose(`delay ${ms}`);
        return delay(ms);
    }

    private async _comment(comment: string) {
        this._log.info(comment);
    }

    private async _handleCommandError(err: Error, command: string, callsite: string) {
        this._log.warn(`"${command}" command error at ${callsite}`);

        if (this._conf.onCommandError !== null) {
            try {
                await this._conf.onCommandError(this);
            }
            catch (oceError) {
                this._log.error('onCommandError error');
                this._log.error(oceError);
            }
        }

        // save a screenshot when fatal error occurs
        const fatalErrorScreenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot());
        await fatalErrorScreenshotBitmap.toPNGFile(pathlib.resolve(this._conf.workspaceDir, this._currentTest.id + '___fatal.png'));

        if (this._conf.testBailout) {
            throw new TestBailoutError(err.stack || err.message);
        }

        if (this._conf.bailout) {
            throw new BailoutError(err.stack || err.message);
        }
    }

    private async _screenshot(selector?: string) {
        const callsite = getCallSiteForDirectAPI();
        const refImgDir = pathlib.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = pathlib.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);

        const refImgName = `${this._assertCount}.png`;
        const refImgPath = pathlib.resolve(refImgDir, refImgName);
        const refImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceScreenshotsDir), refImgPath);

        if (this._currentBeforeAssert) {
            await this._currentBeforeAssert(this.directAPI);
        }
        await mkdirpAsync(refImgDir, {});

        let screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot({ selector }));

        const screenshots = [screenshotBitmap];
        const diffResults: ImageDiffResult[] = [];

        // region save new ref img
        try {
            await fsp.access(refImgPath, fs.constants.F_OK);
        }
        catch (error) {
            await screenshotBitmap.toPNGFile(refImgPath);

            // this._tapWriter.ok(`new reference image added: ${refImgPathRelative}`);
            this._log.info(`new reference image added: ${refImgPathRelative}`);

            await this._runCurrentAfterAssertTasks();
            return;
        }
        // endregion

        const refImg = await Bitmap.from(refImgPath);

        const assertRetryMaxAttempts = this._conf.assertRetryCount + 1;
        let imgDiffResult;
        let formattedPPM;

        for (let assertAttempt = 0; assertAttempt < assertRetryMaxAttempts; assertAttempt++) {
            imgDiffResult = bufferImageDiff(screenshotBitmap, refImg, this._conf.imageDiffOptions);
            diffResults.push(imgDiffResult);
            formattedPPM = String(imgDiffResult.difference).replace(/\.(\d)\d+/, '.$1');

            if (imgDiffResult.same) {
                // this._tapWriter.ok(`screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, retries: ${assertAttempt}`);
                this._log.verbose(`OK screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, retries: ${assertAttempt} at ${callsite.toString()}`);

                await this._runCurrentAfterAssertTasks();
                return;
            }

            this._log.verbose(`screenshot assert failed: ${refImgPathRelative}, ppm: ${formattedPPM}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, attempt#: ${assertAttempt} at ${callsite.toString()}`);

            if (assertAttempt < assertRetryMaxAttempts) {
                screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot({ selector }));

                screenshots.push(screenshotBitmap);
                await delay(this._conf.assertRetryInterval);
            }
        }

        this._currentTest.runErrors.push(new AssertError(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`));

        this._log.warn(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`);

        if (this._conf.onAssertError !== null) {
            try {
                await this._conf.onAssertError(this);
            }
            catch (error) {
                this._log.error('onAssertError error');
                this._log.error(error);
            }
        }

        await mkdirpAsync(failedImgDir, {});
        await mkdirpAsync(this._conf.referenceDiffsDir, {});

        for (const [i, diffResult] of diffResults.entries()) {
            const failedImage = screenshots[i];

            // region write failed images

            const failedImgName = i === 0
                ? `${this._assertCount}.png`
                : `${this._assertCount}__attempt_${i + 1}.png`;

            const failedImgPath = pathlib.resolve(failedImgDir, failedImgName);
            const failedImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.workspaceDir), failedImgPath);
            await failedImage.toPNGFile(failedImgPath);
            this._log.info(`failed screenshot added: ${failedImgPathRelative}`);

            // endregion

            // region write diff images


            const diffImgPath = pathlib.resolve(
                this._conf.referenceDiffsDir,
                this._currentBrowser.name.toLowerCase() + '___' + this._currentTest.id + '___' + this._assertCount + `__attempt_${i + 1}.png`,
            );
            const diffImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.workspaceDir), diffImgPath);

            for (const bufIdx of diffResult.diffBufferIndexes as number[]) {
                failedImage.data[bufIdx] = 255;
                failedImage.data[bufIdx + 1] = 0;
                failedImage.data[bufIdx + 2] = 0;
            }

            await failedImage.toPNGFile(diffImgPath);
            this._log.info(`diff screenshot added: ${diffImgPathRelative}`);
            // endregion

            this._testRunReport.screenshots.push({
                assertIndex: this._assertCount,
                attempt: i + 1,
                diffImage: {
                    path: diffImgPath,
                    relativePath: diffImgPathRelative,
                },
                errorImage: {
                    path: failedImgPath,
                    relativePath: failedImgPathRelative,
                },
                referenceImage: {
                    path: refImgPath,
                    relativePath: refImgPathRelative,
                },
                testName: this._currentTest.id,
            });
        }

        await this._runCurrentAfterAssertTasks();
    }

    private async _runCurrentAfterAssertTasks() {
        if (this._currentAfterAssert) {
            try {
                await this._currentAfterAssert(this.directAPI);
            }
            catch (error) {
                this._log.verbose('_runCurrentAfterAssert catch');
                this._log.error(error.stack || error.message);
                process.exitCode = 1;
            }
        }

        this._assertCount++;
    }

    private _startExitTimeout() {
        setTimeout(() => {
            this._log.error('Exit timeout reached');
            process.exit(process.exitCode);
        }, this._conf.exitTimeout).unref();
    }
}

function getCallSiteForDirectAPI() {
    const unknownPathStr = '???';
    const stack = callsites();
    for (let i = 0; i < stack.length; i++) {
        const filePath = stack[i].getFileName();
        if (filePath === null) {
            return unknownPathStr;
        }
        const basename = pathlib.basename(filePath);
        // filtered: 
        // internal/**/*
        // **/testrunner.*
        if (!filePath.startsWith('internal') && basename !== 'testrunner.js') {
            return stack[i].toString();
        }
    }
    return unknownPathStr;
}

function ellipsis(s: string, l = ELLIPSIS_LIMIT) {
    if (s.length <= l) {
        return s;
    }

    return `${s.substr(0, l - 3)}...`;
}

async function multiGlobAsync(globs: string[]) {
    let paths: string[] = [];

    for (const glob of globs) {
        paths = paths.concat(await globAsync(glob));
    }

    return paths;
}

function getIdFromName(name: string) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}

function prettyMs(ms: unknown, opts?: unsafePrettyMs.Options) {
    return typeof ms === 'number' && ms >= 0 ? unsafePrettyMs(ms, opts) : '? ms';
}

export default Testrunner;
