"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_isequal_1 = __importDefault(require("lodash.isequal"));
const fs_1 = __importDefault(require("fs"));
const fs_2 = require("fs");
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const assert_1 = __importDefault(require("assert"));
const events_1 = require("events");
const mkdirp_1 = __importDefault(require("mkdirp"));
const mkdirpAsync = util_1.default.promisify(mkdirp_1.default);
const pnglib_1 = require("../../modules/pnglib/pnglib");
const glob_1 = __importDefault(require("glob"));
const globAsync = util_1.default.promisify(glob_1.default);
const image_diff_1 = __importDefault(require("../../modules/buffer-image-diff/image-diff"));
const pretty_ms_1 = __importDefault(require("pretty-ms"));
const delay_1 = __importDefault(require("../../modules/delay/delay"));
const logger_1 = require("../logging/logger");
const callsites_1 = __importDefault(require("callsites"));
const TEST_STATE = {
    SCHEDULED: 'scheduled',
    PASSED: 'passed',
    FAILED: 'failed',
};
const DEFAULT_TEST_NAME = '(Unnamed test)';
const ELLIPSIS_LIMIT = 40;
const DEFAULT_SUITE_NAME = '(Unnamed suite)';
const DEFAULT_REF_SCREENSHOTS_DIR = 'reference-screenshots';
const DEFAULT_REF_ERRORS_DIR = 'reference-errors';
const DEFAULT_REF_DIFFS_DIR = 'reference-diffs';
const REPORT_FILE_NAME = 'test-run-report.json';
class AssertError extends Error {
    constructor(message) {
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
    constructor({ message, testErrors = null }) {
        super(message);
        this.testErrors = testErrors || [];
        this.name = 'TestFailedError';
    }
}
class BailoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BailoutError';
    }
}
class TestBailoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TestBailoutError';
    }
}
class Testrunner extends events_1.EventEmitter {
    constructor(conf) {
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
            testFilter: null,
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
            if (conf[key] === undefined) {
                delete conf[key];
            }
        }
        this._conf = Object.assign(defaultConf, conf);
        this._conf.imageDiffOptions = Object.assign({}, defaultImageDiffOptions, conf.imageDiffOptions);
        const logFilePath = path_1.default.resolve(this._conf.workspaceDir, 'run.log');
        logger_1.logger.init(this._conf.consoleLogLevel, this._conf.fileLogLevel, logFilePath);
        this._log = logger_1.logger.childLogger('Testrunner');
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
            assert: this._assert.bind(this),
            pressKey: this._pressKeyDirect.bind(this),
            mouseover: this._mouseoverDirect.bind(this),
            execFunction: this._execFunctionDirect.bind(this),
        };
        this.sideEffectAPI = {};
        Object.keys(this.directAPI).forEach(key => {
            if (/delay|comment/.test(key)) {
                return;
            }
            const directAPIFn = this.directAPI[key];
            this.sideEffectAPI[key] = this._wrapFunctionWithSideEffects(directAPIFn, key);
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
            const failedTestNames = [];
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
                await fs_2.promises.writeFile(path_1.default.resolve(this._conf.workspaceDir, 'screenshot-catalog.json'), JSON.stringify(this._testRunReport.screenshots, null, 4));
                await fs_2.promises.writeFile(path_1.default.resolve(this._conf.workspaceDir, REPORT_FILE_NAME), JSON.stringify(this._testRunReport, null, 4));
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
            await delay_1.default(500);
        }
        this._isAborting = false;
        this._log.info('aborted!');
    }
    isRunning() {
        return this._isRunning;
    }
    async _runBrowsers() {
        const conf = this._conf;
        for (const browser of conf.browsers) {
            this._currentBrowser = browser;
            if (this._isAborting) {
                throw new AbortError();
            }
            await this._runSuites();
        }
    }
    async _runSuites() {
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
    async _runSuite(suite) {
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
    async _runTestWithRetries({ suite, test }) {
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
    async _runTest({ suite, test }) {
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
    async _runTestCore({ suite, test }) {
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
    async _parseSuiteTestfiles() {
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
    async _parseTestFiles(testFilePaths) {
        const tests = [];
        function testRegistrar(arg0, arg1) {
            let name;
            let testFn;
            if (arg1 === undefined) {
                assert_1.default(typeof arg0 === 'function');
                name = DEFAULT_TEST_NAME;
                testFn = arg0;
            }
            else {
                assert_1.default(typeof arg0 === 'string');
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
            const absPath = path_1.default.resolve(path);
            require(absPath)(testRegistrar, this);
        }
        return tests;
    }
    _wrapFunctionWithSideEffects(fn, cmdType) {
        return async (...args) => {
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
    async _execCommandWithAPI(cmd, api) {
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
    async _execCommandDirect(cmd) {
        return this._execCommandWithAPI(cmd, this.directAPI);
    }
    async _execCommandSideEffect(cmd) {
        return this._execCommandWithAPI(cmd, this.sideEffectAPI);
    }
    async _execCommandsDirect(cmds) {
        for (const cmd of cmds) {
            await this._execCommandDirect(cmd);
        }
    }
    async _execCommandsSideEffect(cmds) {
        for (const cmd of cmds) {
            await this._execCommandSideEffect(cmd);
        }
    }
    async _runBrowserCommandWithRetries(browserFnName, args, callsite) {
        let retries = 0;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            this._log.verbose(`_execCommandWithRetries - attempt: ${retries}, command: ${browserFnName}, args: ${util_1.default.inspect(args)}`);
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
                    await delay_1.default(this._conf.commandRetryInterval);
                    continue;
                }
                this._log.verbose('_execCommandWithRetries - failure, max retries reached');
                throw err;
            }
        }
    }
    _equal(actual, expected, description) {
        if (lodash_isequal_1.default(actual, expected)) {
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
    async _clickDirect(selector /* , options*/) {
        this._log.verbose(`click: "${ellipsis(selector)}"`);
        const callsite = getCallSiteForDirectAPI();
        try {
            await this._runBrowserCommandWithRetries('click', [selector], callsite);
        }
        catch (err) {
            await this._handleCommandError(err, 'click', callsite);
        }
    }
    async _getValueDirect(selector) {
        this._log.verbose(`getValue: "${ellipsis(selector)}"`);
        return this._currentBrowser.getValue(selector);
    }
    async _setValueDirect(selector, value) {
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
    async _setFileInputDirect(selector, filePath, options) {
        this._log.verbose(`setFileInput: "${selector}", "${filePath}"`);
        const callsite = getCallSiteForDirectAPI();
        const opts = { ...{ waitForVisible: true, checkSelectorType: true }, ...options };
        try {
            await this._runBrowserCommandWithRetries(async () => {
                if (opts.waitForVisible) {
                    await this._currentBrowser.waitForVisible(selector);
                }
                if (opts.checkSelectorType) {
                    const isFileInput = await this._currentBrowser.execFunction((s) => {
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
    async _pressKeyDirect(keyCode) {
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
    async _waitForVisibleDirect(selector, opts = {}) {
        this._log.verbose(`waitForVisible: "${ellipsis(selector)}"`);
        const callsite = getCallSiteForDirectAPI();
        try {
            await this._currentBrowser.waitForVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitForVisible', callsite);
        }
    }
    async _waitWhileVisibleDirect(selector, opts = {}) {
        this._log.verbose(`waitWhileVisible: "${ellipsis(selector)}"`);
        const callsite = getCallSiteForDirectAPI();
        try {
            await this._currentBrowser.waitWhileVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitWhileVisible', callsite);
        }
    }
    async _isVisibleDirect(selector) {
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
    async _focusDirect(selector /* , options*/) {
        this._log.verbose(`focus: "${ellipsis(selector)}"`);
        try {
            await this._currentBrowser.focus(selector);
        }
        catch (err) {
            // TODO handle as error?
            this._log.warn(`WARNING - focus failed - ${err.message}`);
        }
    }
    async _scrollDirect(selector, scrollTop) {
        this._log.verbose(`scroll: ${scrollTop}, "${ellipsis(selector)}"`);
        const callsite = getCallSiteForDirectAPI();
        try {
            await this._currentBrowser.scroll(selector, scrollTop);
        }
        catch (err) {
            await this._handleCommandError(err, 'scroll', callsite);
        }
    }
    async _scrollToDirect(selector) {
        this._log.verbose(`scrollTo: "${ellipsis(selector)}"`);
        const callsite = getCallSiteForDirectAPI();
        try {
            await this._currentBrowser.scrollIntoView(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'scrollTo', callsite);
        }
    }
    async _mouseoverDirect(selector) {
        this._log.verbose(`mouseover: ${selector}`);
        const callsite = getCallSiteForDirectAPI();
        try {
            this._currentBrowser.hover(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'mouseover', callsite);
        }
    }
    async _execFunctionDirect(fn, ...args) {
        this._log.verbose(`execFunction: ${fn.name || '(anonymous)'}`);
        return this._currentBrowser.execFunction(fn, ...args);
    }
    async _delay(ms) {
        this._log.verbose(`delay ${ms}`);
        return delay_1.default(ms);
    }
    async _comment(comment) {
        this._log.info(comment);
    }
    async _handleCommandError(err, command, callsite) {
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
        const fatalErrorScreenshotBitmap = await pnglib_1.Bitmap.from(await this._currentBrowser.screenshot());
        await fatalErrorScreenshotBitmap.toPNGFile(path_1.default.resolve(this._conf.workspaceDir, this._currentTest.id + '___fatal.png'));
        if (this._conf.testBailout) {
            throw new TestBailoutError(err.stack || err.message);
        }
        if (this._conf.bailout) {
            throw new BailoutError(err.stack || err.message);
        }
    }
    async _assert() {
        const callsite = getCallSiteForDirectAPI();
        const refImgDir = path_1.default.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = path_1.default.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const refImgName = `${this._assertCount}.png`;
        const refImgPath = path_1.default.resolve(refImgDir, refImgName);
        const refImgPathRelative = path_1.default.relative(path_1.default.resolve(this._conf.referenceScreenshotsDir), refImgPath);
        if (this._currentBeforeAssert) {
            await this._currentBeforeAssert(this.directAPI);
        }
        await mkdirpAsync(refImgDir, {});
        let screenshotBitmap = await pnglib_1.Bitmap.from(await this._currentBrowser.screenshot());
        const screenshots = [screenshotBitmap];
        const diffResults = [];
        // region save new ref img
        try {
            await fs_2.promises.access(refImgPath, fs_1.default.constants.F_OK);
        }
        catch (error) {
            await screenshotBitmap.toPNGFile(refImgPath);
            // this._tapWriter.ok(`new reference image added: ${refImgPathRelative}`);
            this._log.info(`new reference image added: ${refImgPathRelative}`);
            await this._runCurrentAfterAssertTasks();
            return;
        }
        // endregion
        const refImg = await pnglib_1.Bitmap.from(refImgPath);
        const assertRetryMaxAttempts = this._conf.assertRetryCount + 1;
        let imgDiffResult;
        let formattedPPM;
        for (let assertAttempt = 0; assertAttempt < assertRetryMaxAttempts; assertAttempt++) {
            imgDiffResult = image_diff_1.default(screenshotBitmap, refImg, this._conf.imageDiffOptions);
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
                screenshotBitmap = await pnglib_1.Bitmap.from(await this._currentBrowser.screenshot());
                screenshots.push(screenshotBitmap);
                await delay_1.default(this._conf.assertRetryInterval);
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
            const failedImgPath = path_1.default.resolve(failedImgDir, failedImgName);
            const failedImgPathRelative = path_1.default.relative(path_1.default.resolve(this._conf.workspaceDir), failedImgPath);
            await failedImage.toPNGFile(failedImgPath);
            this._log.info(`failed screenshot added: ${failedImgPathRelative}`);
            // endregion
            // region write diff images
            const diffImgPath = path_1.default.resolve(this._conf.referenceDiffsDir, this._currentBrowser.name.toLowerCase() + '___' + this._currentTest.id + '___' + this._assertCount + `__attempt_${i + 1}.png`);
            const diffImgPathRelative = path_1.default.relative(path_1.default.resolve(this._conf.workspaceDir), diffImgPath);
            for (const bufIdx of diffResult.diffBufferIndexes) {
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
    async _runCurrentAfterAssertTasks() {
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
    _startExitTimeout() {
        setTimeout(() => {
            this._log.error('Exit timeout reached');
            process.exit(process.exitCode);
        }, this._conf.exitTimeout).unref();
    }
}
Testrunner.AbortError = AbortError;
Testrunner.AssertError = AssertError;
function getCallSiteForDirectAPI() {
    const stack = callsites_1.default();
    // We expect the stack to look like this:
    //
    // stack[0]: this function 
    // stack[1]: _xyDirect
    // stack[2]: _xyDirect.bind()
    // stack[3]: calling test script
    // 
    // Sometimes stack[3] can point to node internals, so it is checked and
    // skipped.
    for (let i = 3; i < stack.length; i++) {
        if (!stack[i].getFileName().startsWith('internal')) {
            return stack[i];
        }
    }
    return '';
}
function ellipsis(s, l = ELLIPSIS_LIMIT) {
    if (s.length <= l) {
        return s;
    }
    return `${s.substr(0, l - 3)}...`;
}
async function multiGlobAsync(globs) {
    let paths = [];
    for (const glob of globs) {
        paths = paths.concat(await globAsync(glob));
    }
    return paths;
}
function getIdFromName(name) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}
function prettyMs(ms, opts) {
    return typeof ms === 'number' && ms >= 0 ? pretty_ms_1.default(ms, opts) : '? ms';
}
exports.default = Testrunner;
