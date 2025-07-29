import fs, { promises as fsp } from 'fs';
import pathlib from 'path';
import util from 'util';
import assert from 'assert';
import { EventEmitter } from 'events';
import Bitmap from '../../modules/pnglib/pnglib';
import bufferImageDiff, { ImageDiffOptions, ImageDiffResult } from '../../modules/buffer-image-diff/image-diff';
import delay from '../../modules/delay/delay';
import { IBrowser } from '../../modules/browsers/browser-interface';
import { logger, ChildLogger } from '../logging/logger';
import { AbortError, ScreenshotError, BailoutError, CommandError, TestBailoutError, TestFailedError } from './errors';
import { ellipsis, getIdFromName, prettyMs } from '../utils';
import { TestrunnerConfig, Suite, Test, Command, TestRunReport, DirectAPICallback, BeforeAfterCommandCallback, TestAssertAPIDirect, TestAPI, TestFn } from '../../types';
import { TEST_STATE } from '../../constants';
import { PluginManager } from '../PluginManager';

import waitWhileVisible from './commands/waitWhileVisible';
import waitForVisible from './commands/waitForVisible';
import click from './commands/click';
import focus from './commands/focus';
import scroll from './commands/scroll';
import scrollTo from './commands/scrollTo';
import setValue from './commands/setValue';
import setFileInput from './commands/setFileInput';
import pressKey from './commands/pressKey';
import delayCmd from './commands/delay';
import execFunction from './commands/execFunction';
import { glob } from 'glob';

const DEFAULT_TEST_NAME = '(Unnamed test)';

const DEFAULT_SUITE_NAME = '(Unnamed suite)';

const DEFAULT_REF_SCREENSHOTS_DIR = 'reference-screenshots';
const DEFAULT_REF_ERRORS_DIR = 'reference-errors';
const DEFAULT_REF_DIFFS_DIR = 'reference-diffs';

const REPORT_FILE_NAME = 'test-run-report.json';

export default class Testrunner extends EventEmitter {
    _conf: TestrunnerConfig;
    _log: ChildLogger;
    private _isRunning: boolean;
    _isAborting: boolean;
    private _assertCount: number;
    private _foundTestsCount: number;
    private _okTestsCount: number;
    private _testRunReport: TestRunReport;
    private _currentTest: Test;
    _currentBeforeCommand: BeforeAfterCommandCallback | null;
    _currentAfterCommand: BeforeAfterCommandCallback | null;
    private _currentBeforeScreenshot: DirectAPICallback | null;
    private _currentAfterScreenshot: DirectAPICallback | null;
    _currentBrowser: IBrowser | null;

    directAPI: TestAssertAPIDirect;
    sideEffectAPI: TestAssertAPIDirect;
    tAPI: TestAPI;

    pluginManager: PluginManager;

    constructor(conf: Partial<TestrunnerConfig>) {
        super();

        const defaultConf: TestrunnerConfig = {
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
            assertRetryCount: 0,
            assertRetryInterval: 1000,
            testRetryCount: 0,
            testRetryFilter: /.+/,
            onCommandError: null,
            onAssertError: null,
            commandRetryCount: 4,
            commandRetryInterval: 250,
            exitTimeout: 5 * 60000,
            testApiMixins: {},
        };

        const defaultImageDiffOptions: ImageDiffOptions = {
            colorThreshold: 3,
            imageThreshold: 20,
            includeDiffBufferIndexes: true,
        };

        this._conf = { ...defaultConf, ...conf };
        this._conf.imageDiffOptions = { ...defaultImageDiffOptions, ...conf.imageDiffOptions };

        const logFilePath = pathlib.resolve(this._conf.workspaceDir, 'run.log');
        logger.init(this._conf.consoleLogLevel, this._conf.fileLogLevel, logFilePath);
        this._log = logger.childLogger('Testrunner');

        this._currentBeforeCommand = null;
        this._currentAfterCommand = null;

        this._currentBeforeScreenshot = null;
        this._currentAfterScreenshot = null;

        this._isRunning = false;
        this._isAborting = false;

        this.pluginManager = new PluginManager();

        if (!Array.isArray(this._conf.browsers)) {
            this._conf.browsers = [this._conf.browsers];
        }

        this.directAPI = {
            getValue: this._getValueDirect.bind(this),
            setValue: async (selector: string, value: string) => setValue({ selector, value, testrunner: this }),
            setFileInput: async (selector: string, filePath: string[], options?: { waitForVisible?: boolean, checkSelectorType?: boolean }) => setFileInput({ selector, filePath, options, testrunner: this }),
            click: async (selector: string) => click({ selector, testrunner: this }),
            waitForVisible: async (selector: string, opts: { timeout?: number } = {}) => waitForVisible({ selector, opts, testrunner: this }),
            waitWhileVisible: async (selector: string, opts: { timeout?: number } = {}) => waitWhileVisible({ selector, opts, testrunner: this }),
            isVisible: this._isVisibleDirect.bind(this),
            focus: async (selector: string) => focus({ selector, testrunner: this }),
            scroll: async (selector: string, scrollTop: number) => scroll({ selector, scrollTop, testrunner: this }),
            scrollTo: async (selector: string) => scrollTo({ selector, testrunner: this }),
            delay: async (amount: number) => delayCmd({ amount, testrunner: this }),
            comment: this._comment.bind(this),
            screenshot: async (opts: {selector?: string, fullPage?: boolean} | string = {}) => this._screenshot(opts),
            pressKey: async (keyCode: string) => pressKey({ keyCode, testrunner: this }),
            mouseover: this._mouseoverDirect.bind(this),
            execFunction: async (fn: Function, ...args: any[]) => execFunction({ fn, args, testrunner: this }),
            execCommands: this._execCommandsDirect.bind(this),
        } as TestAssertAPIDirect;

        // NTH rename to public api? lifecycled api?
        this.sideEffectAPI = {
            setValue: async (selector: string, value: string) => setValue({ selector, value, testrunner: this, callHooks: true, callLifecycles: true }),
            setFileInput: async (selector: string, filePath: string[], options?: { waitForVisible?: boolean, checkSelectorType?: boolean }) => setFileInput({ selector, filePath, options, testrunner: this, callHooks: true, callLifecycles: true }),
            click: async (selector: string) => click({ selector, testrunner: this, callHooks: true, callLifecycles: true }),
            waitForVisible: async (selector: string, opts: { timeout?: number } = {}) => waitForVisible({ selector, opts, testrunner: this, callHooks: true, callLifecycles: true }),
            waitWhileVisible: async (selector: string, opts: { timeout?: number } = {}) => waitWhileVisible({ selector, opts, testrunner: this, callHooks: true, callLifecycles: true }),
            focus: async (selector: string) => focus({ selector, testrunner: this, callHooks: true, callLifecycles: true }),
            scroll: async (selector: string, scrollTop: number) => scroll({ selector, scrollTop, testrunner: this, callHooks: true, callLifecycles: true }),
            scrollTo: async (selector: string) => scrollTo({ selector, testrunner: this, callHooks: true, callLifecycles: true }),
            delay: this.directAPI.delay,
            comment: this.directAPI.comment,
            screenshot: async (opts: {selector?: string, fullPage?: boolean} | string = {}) => this._screenshot({ ...(typeof opts === 'string' ? { selector: opts } : opts), callLifecycles: true }),
            pressKey: async (keyCode: string) => pressKey({ keyCode, testrunner: this, callHooks: true, callLifecycles: true }),
            execFunction: async (fn: Function, ...args: any[]) => execFunction({ fn, args, testrunner: this, callHooks: true, callLifecycles: true }),
            execCommands: this._execCommandsSideEffect.bind(this),
        } as TestAssertAPIDirect;

        // old wrapper, remove in future
        ['getValue', 'isVisible', 'mouseover'].forEach(key => {
            const directAPIFn = this.directAPI[key as keyof TestAssertAPIDirect];
            this.sideEffectAPI[key as keyof TestAssertAPIDirect] = this._wrapFunctionWithSideEffects(directAPIFn, key as keyof TestAssertAPIDirect);
        });

        this.tAPI = {
            ...this.sideEffectAPI,
            equal: this._equal.bind(this),
            equals: this._equal.bind(this),
            ok: this._ok.bind(this),
            mixins: this.getTestApiMixinsBound(),
            callPluginHook: this.pluginManager.callHook.bind(this.pluginManager),
        };

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

        for (const plugin of conf.plugins || []) {
            await this.pluginManager.loadPlugin(plugin);
        }

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
            this.setExitCode(1);
            this._log.error(error);
        }
        finally {
            this._log.info(`Finished in ${prettyMs(Date.now() - runStartTime, { verbose: true })}`);

            const effectiveTestsCount = this._foundTestsCount * this._conf.browsers.length;

            this._log.info(`Tests: ${effectiveTestsCount}`);
            this._log.info(`Pass: ${this._okTestsCount}`);

            const failedTestNames: Set<string> = new Set();

            if (effectiveTestsCount !== this._okTestsCount) {
                this.setExitCode(1);

                this._log.warn('---');

                conf.suites.forEach(suite => {
                    suite.tests.forEach(test => {
                        if (test.state === TEST_STATE.FAILED) {
                            failedTestNames.add(test.name);

                            this._log.warn(`[FAIL] "${test.name}" (suite: "${suite.name}")`);

                            test.runErrors.forEach(err => {
                                this._log.warn(`    [reason] ${err}`);
                            });
                        }
                    });
                });

                this._log.warn('---');
                this._log.warn('FAILURE');
            }
            else {
                this._log.info('SUCCESS');
            }

            this._testRunReport.testsCount = effectiveTestsCount;
            this._testRunReport.passedCount = this._okTestsCount;
            this._testRunReport.failedCount = this._testRunReport.testsCount - this._testRunReport.passedCount; // TODO error? use effectiveTestsCount
            this._testRunReport.passed = this._testRunReport.testsCount === this._testRunReport.passedCount; // TODO redundant? remove
            this._testRunReport.runTimeMs = Date.now() - runStartTime;
            this._testRunReport.failedTestNames = [...failedTestNames];

            this._log.info(`__report__: ${JSON.stringify({
                testsCount: this._testRunReport.testsCount,
                passedCount: this._testRunReport.passedCount,
                failedCount: this._testRunReport.failedCount,
                runTimeMs: this._testRunReport.runTimeMs,
            })}`);

            try {
                // TODO deprecated, remove in future
                await fsp.writeFile(pathlib.resolve(this._conf.workspaceDir, 'screenshot-catalog.json'), JSON.stringify(this._testRunReport.screenshots, null, 4));

                await fsp.writeFile(pathlib.resolve(this._conf.workspaceDir, REPORT_FILE_NAME), JSON.stringify(this._testRunReport, null, 4));
            }
            catch (err) {
                this._log.error(err);
            }

            this._isRunning = false;

            await this.pluginManager.callHook('runEnd', {
                success: this._testRunReport.passed,
                endTime: Date.now(),
            });

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
        this._log.info('Suite waitUntil: ' + suite.waitUntil);

        for (const test of suite.tests) {
            if (this._isAborting) {
                throw new AbortError();
            }

            this.pluginManager.callHook('suiteStart', { suiteId: suite.name, suiteName: suite.name, startTime: Date.now() });

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
            finally {
                this.pluginManager.callHook('suiteEnd', { suiteId: suite.name, suiteName: suite.name, endTime: Date.now() });
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
                this._testRunReport.screenshots = this._testRunReport.screenshots.filter(item => item.testName !== test.name);

                this._log.verbose(`_runTestWithRetries: success, test '${test.name}' passed`);
                break;
            }
            catch (error) {
                this._log.debug('_runTestWithRetries: error when running _runTest:');
                this._log.debug(error);

                if (attempt === maxAttempts) {
                    throw error;
                }

                this._log.warn(`Test "${test.name}" failed, retrying`);

                if (error.testErrors && error.testErrors.length > 0) {
                    this._log.debug(error.testErrors.map(String).join('\n'));
                }
            }
        }
    }

    private async _runTest({ suite, test }: { suite: Suite, test: Test }) {
        this._log.verbose(`_runTest: running test ${test.name}`);

        await this.pluginManager.callHook('testStart', { testId: test.id, testName: test.name, startTime: Date.now() });

        const browser = this._currentBrowser;

        test.runErrors = [];

        this._log.verbose(`starting browser "${browser.name}"`);
        try {
            await browser.start();
            this._log.verbose(`started browser "${browser.name}"`);
        }
        catch (error) {
            this._log.error(`browser "${browser.name}" failed to start (${error})`);
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
            await this.pluginManager.callHook('testEnd', { testId: test.id, testName: test.name, success: test.state === TEST_STATE.PASSED, endTime: Date.now(), errors: test.runErrors });

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
                // eslint-disable-next-line no-unsafe-finally
                throw error;
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

        await this._currentBrowser.navigateTo(suite.appUrl, { waitUntil: suite.waitUntil ?? 'load' });

        if (suite.beforeFirstCommand) {
            await suite.beforeFirstCommand(this.directAPI);
        }

        this._currentBeforeCommand = suite.beforeCommand || null;
        this._currentAfterCommand = suite.afterCommand || null;
        this._currentBeforeScreenshot = suite.beforeAssert || null;
        this._currentAfterScreenshot = suite.afterAssert || null;

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
            suite.tests = await this._parseTestFiles(await glob(suite.testFiles));

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
            const module = require(absPath);

            if (typeof module === 'function') {
                module(testRegistrar, this); // commonjs
            }
            else if (typeof module.default === 'function') {
                module.default(testRegistrar, this); // es6
            }
            else {
                throw new Error(`Error while parsing test file: "${absPath}"`);
            }
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

    async _runBrowserCommandWithRetries(browserFnName: string | Function, args: any[]) {
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
                        this._log.debug(`command error, retrying "${browserFnName}" at ${getErrorOrigin(err)}`);
                    }
                    else {
                        this._log.debug(`command error, retrying at ${getErrorOrigin(err)}`);
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

    private _ok(value: any, description?: string) {
        if (value) {
            this._log.info('ok OK: ' + (description || '(no description)'));
        }
        else {
            this._log.error('ok FAIL: ' + (description || '(no description)'));
            throw new Error(`Testrunner._ok: FAIL (value: "${value}", description: ${description || '(no description)'})`);
        }
    }

    private _equal(actual: unknown, expected: unknown, description: string) {
        if (util.isDeepStrictEqual(actual, expected)) {
            this._log.info('equal OK: ' + (description || '(unnamed)'));
        }
        else {
            this._log.error('equal FAIL: ' + (description || '(unnamed)'));
            throw new Error(`Testrunner._equal: FAIL (actual: ${actual}, expected: ${expected}, description: ${description || '(none)'})`);
        }
    }

    private async _getValueDirect(selector: string) {
        this._log.verbose(`getValue: "${ellipsis(selector)}"`);

        return this._currentBrowser.getValue(selector);
    }

    private async _isVisibleDirect(selector: string) {
        this._log.verbose(`isVisible: "${ellipsis(selector)}"`);

        try {
            const result = await this._currentBrowser.isVisible(selector);
            return result;
        }
        catch (err) {
            await this._handleCommandError(err, 'isVisible');
        }
    }

    private async _mouseoverDirect(selector: string) {
        this._log.verbose(`mouseover: ${selector}`);

        try {
            this._currentBrowser.hover(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'mouseover');
        }
    }

    private async _comment(comment: string) {
        this._log.info(comment);
    }

    async _handleCommandError(err: Error, command: string) {
        Error.captureStackTrace(err);

        const formattedErrorMessage = `"${command}" command error: ${err.message}\n${getErrorOrigin(err)}`;

        this._log.warn(formattedErrorMessage);
        this._log.verbose(err);

        this._currentTest.runErrors.push(new CommandError(formattedErrorMessage));

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

    getPNGScreenshot = async () => {
        const screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot());
        const pngBuffer = await screenshotBitmap.toPNGBuffer();
        return pngBuffer;
    }

    private async _screenshot(options: { selector?: string, fullPage?: boolean, callHooks?: boolean, callLifecycles?: boolean } | string = {}) {
        options = typeof options === 'string' ? { selector: options } : options;

        if (options.callLifecycles) {
            await this._currentBeforeCommand?.(this.directAPI, { type: 'screenshot' });
        }

        const refImgDir = pathlib.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = pathlib.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);

        const refImgName = `${this._assertCount}.png`;
        const refImgPath = pathlib.resolve(refImgDir, refImgName);
        const refImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceScreenshotsDir), refImgPath);

        await this._currentBeforeScreenshot?.(this.directAPI);

        await fsp.mkdir(refImgDir, { recursive: true });

        const startTime = Date.now();
        let screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot({ selector: options.selector, fullPage: options.fullPage }));

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

            await this._runCurrentAfterScreenshotTasks();
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
                this._log.verbose(`OK screenshot (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, retries: ${assertAttempt}`);

                this.pluginManager.callHook('screenshot', { selector: options.selector, startTime, endTime: Date.now(), getScreenshot: this.getPNGScreenshot, success: true });

                await this._runCurrentAfterScreenshotTasks();
                return;
            }

            this._log.verbose(`screenshot failed: ${refImgPathRelative}, ppm: ${formattedPPM}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, attempt#: ${assertAttempt}`);

            if (assertAttempt < assertRetryMaxAttempts) {
                screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot({ selector: options.selector, fullPage: options.fullPage }));

                screenshots.push(screenshotBitmap);
                await delay(this._conf.assertRetryInterval);
            }
        }

        const screenshotError = new ScreenshotError(`FAIL screenshot (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`);
        screenshotError.message += '\n' + getErrorOrigin(screenshotError);

        this.pluginManager.callHook('screenshot', { selector: options.selector, startTime, endTime: Date.now(), getScreenshot: this.getPNGScreenshot, success: false });

        this._currentTest.runErrors.push(screenshotError);

        this._log.error(screenshotError);

        if (this._conf.onAssertError !== null) {
            try {
                await this._conf.onAssertError(this);
            }
            catch (error) {
                this._log.error('onAssertError error');
                this._log.error(error);
            }
        }

        await fsp.mkdir(failedImgDir, { recursive: true });
        await fsp.mkdir(this._conf.referenceDiffsDir, { recursive: true });

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

        await this._runCurrentAfterScreenshotTasks();

        if (options.callLifecycles) {
            await this._currentAfterCommand?.(this.directAPI, { type: 'screenshot' });
        }
    }

    private async _runCurrentAfterScreenshotTasks() {
        if (this._currentAfterScreenshot) {
            try {
                await this._currentAfterScreenshot(this.directAPI);
            }
            catch (error) {
                this._log.verbose('_runCurrentAfterAssert catch');
                this._log.error(error.stack || error.message);
                this.setExitCode(1);
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

    private setExitCode(code) {
        this._log.verbose(`setExitCode: ${code}`);
        process.exitCode = code;
    }

    private getTestApiMixinsBound() {
        const tApiMixins = {};

        for (const key of Reflect.ownKeys(this._conf.testApiMixins ?? {}) as string[]) {
            if (!(typeof this._conf.testApiMixins[key] === 'function')) {
                continue;
            }

            tApiMixins[key] = (...args) => this._conf.testApiMixins[key](this.tAPI, ...args);

        }

        return tApiMixins;
    }
}

function getErrorOrigin(err: Error) {
    if (!err.stack) {
        return '    at (unknown call site)';
    }

    return err.stack.split(/[\r\n]/)
    .slice(1)
    .filter(s => !/testrunner\.js|node_modules[/\\]|<anonymous>|internal/.test(s))
    .join('\n');
}
