"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_isequal_1 = __importDefault(require("lodash.isequal"));
const fs_1 = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = __importDefault(require("util"));
const assert_1 = __importDefault(require("assert"));
const events_1 = require("events");
const pnglib_1 = __importDefault(require("../../modules/pnglib/pnglib"));
const image_diff_1 = __importDefault(require("../../modules/buffer-image-diff/image-diff"));
const delay_1 = __importDefault(require("../../modules/delay/delay"));
const logger_1 = require("../logging/logger");
const errors_1 = require("./errors");
const utils_1 = require("../utils");
const constants_1 = require("../../constants");
const DEFAULT_TEST_NAME = '(Unnamed test)';
const DEFAULT_SUITE_NAME = '(Unnamed suite)';
const DEFAULT_REF_SCREENSHOTS_DIR = 'reference-screenshots';
const DEFAULT_REF_ERRORS_DIR = 'reference-errors';
const DEFAULT_REF_DIFFS_DIR = 'reference-diffs';
const REPORT_FILE_NAME = 'test-run-report.json';
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
        const defaultImageDiffOptions = {
            colorThreshold: 3,
            imageThreshold: 20,
            includeDiffBufferIndexes: true,
        };
        this._conf = { ...defaultConf, ...conf };
        this._conf.imageDiffOptions = { ...defaultImageDiffOptions, ...conf.imageDiffOptions };
        const logFilePath = path_1.default.resolve(this._conf.workspaceDir, 'run.log');
        logger_1.logger.init(this._conf.consoleLogLevel, this._conf.fileLogLevel, logFilePath);
        this._log = logger_1.logger.childLogger('Testrunner');
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
        this.tAPI = {
            ...this.sideEffectAPI,
            equal: this._equal.bind(this),
            equals: this._equal.bind(this),
            ok: this._ok.bind(this),
            mixins: this.getTestApiMixinsBound(),
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
            this._log.info(`Finished in ${(0, utils_1.prettyMs)(Date.now() - runStartTime, { verbose: true })}`);
            const effectiveTestsCount = this._foundTestsCount * this._conf.browsers.length;
            this._log.info(`Tests: ${effectiveTestsCount}`);
            this._log.info(`Pass: ${this._okTestsCount}`);
            const failedTestNames = new Set();
            if (effectiveTestsCount !== this._okTestsCount) {
                this.setExitCode(1);
                this._log.warn('---');
                conf.suites.forEach(suite => {
                    suite.tests.forEach(test => {
                        if (test.state === constants_1.TEST_STATE.FAILED) {
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
                await fs_1.promises.writeFile(path_1.default.resolve(this._conf.workspaceDir, 'screenshot-catalog.json'), JSON.stringify(this._testRunReport.screenshots, null, 4));
                await fs_1.promises.writeFile(path_1.default.resolve(this._conf.workspaceDir, REPORT_FILE_NAME), JSON.stringify(this._testRunReport, null, 4));
            }
            catch (err) {
                this._log.error(err);
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
            await (0, delay_1.default)(500);
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
                throw new errors_1.AbortError();
            }
            await this._runSuites();
        }
    }
    async _runSuites() {
        const conf = this._conf;
        for (const suite of conf.suites) {
            if (this._isAborting) {
                throw new errors_1.AbortError();
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
        this._log.info('Suite waitUntil: ' + suite.waitUntil);
        for (const test of suite.tests) {
            if (this._isAborting) {
                throw new errors_1.AbortError();
            }
            try {
                this._log.verbose(test.name);
                await this._runTestWithRetries({ suite, test });
                this._log.verbose(`${test.name} (${(0, utils_1.prettyMs)(this._testRunReport.runtimes[test.name])})`);
                this._okTestsCount++;
            }
            catch (error) {
                this._log.warn(`${test.name} (${(0, utils_1.prettyMs)(this._testRunReport.runtimes[test.name])})`);
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
    async _runTest({ suite, test }) {
        this._log.verbose(`_runTest: running test ${test.name}`);
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
        var _a;
        this._log.verbose(`_runTestCore: running test ${test.name}`);
        this._currentTest = test;
        this._assertCount = 0;
        test.runErrors = [];
        test.state = constants_1.TEST_STATE.SCHEDULED;
        let testStartTime = 0;
        await this._currentBrowser.navigateTo(suite.appUrl, { waitUntil: (_a = suite.waitUntil) !== null && _a !== void 0 ? _a : 'load' });
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
                throw new errors_1.TestFailedError({
                    message: `Test "${test.name}" failed`,
                    testErrors: test.runErrors,
                });
            }
            this._testRunReport.runtimes[test.name] = Date.now() - testStartTime;
            test.state = constants_1.TEST_STATE.PASSED;
        }
        catch (error) {
            this._testRunReport.runtimes[test.name] = Date.now() - testStartTime;
            test.state = constants_1.TEST_STATE.FAILED;
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
            suite.tests = await this._parseTestFiles(await (0, utils_1.multiGlobAsync)(suite.testFiles));
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
                (0, assert_1.default)(typeof arg0 === 'function');
                name = DEFAULT_TEST_NAME;
                testFn = arg0;
            }
            else {
                (0, assert_1.default)(typeof arg0 === 'string');
                name = arg0;
                testFn = arg1;
            }
            let id = (0, utils_1.getIdFromName)(name);
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
    _wrapFunctionWithSideEffects(fn, cmdType) {
        return async (...args) => {
            if (this._isAborting) {
                throw new errors_1.AbortError();
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
    async _runBrowserCommandWithRetries(browserFnName, args) {
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
                        this._log.debug(`command error, retrying "${browserFnName}" at ${getErrorOrigin(err)}`);
                    }
                    else {
                        this._log.debug(`command error, retrying at ${getErrorOrigin(err)}`);
                    }
                    this._log.verbose(err);
                    retries++;
                    await (0, delay_1.default)(this._conf.commandRetryInterval);
                    continue;
                }
                this._log.verbose('_execCommandWithRetries - failure, max retries reached');
                throw err;
            }
        }
    }
    _ok(value, description) {
        if (value) {
            this._log.info('ok OK: ' + (description || '(no description)'));
        }
        else {
            this._log.error('ok FAIL: ' + (description || '(no description)'));
            throw new Error(`Testrunner._ok: FAIL (value: "${value}", description: ${description || '(no description)'})`);
        }
    }
    _equal(actual, expected, description) {
        if ((0, lodash_isequal_1.default)(actual, expected)) {
            this._log.info('equal OK: ' + (description || '(unnamed)'));
        }
        else {
            this._log.error('equal FAIL: ' + (description || '(unnamed)'));
            throw new Error(`Testrunner._equal: FAIL (actual: ${actual}, expected: ${expected}, description: ${description || '(none)'})`);
        }
    }
    async _clickDirect(selector /* , options*/) {
        try {
            await this._runBrowserCommandWithRetries('click', [selector]);
        }
        catch (err) {
            await this._handleCommandError(err, 'click');
        }
    }
    async _getValueDirect(selector) {
        this._log.verbose(`getValue: "${(0, utils_1.ellipsis)(selector)}"`);
        return this._currentBrowser.getValue(selector);
    }
    async _setValueDirect(selector, value) {
        this._log.verbose(`setValue: "${(0, utils_1.ellipsis)(value)}", "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._runBrowserCommandWithRetries(async () => {
                // @ts-expect-error
                await this._currentBrowser.execFunction((s) => document.querySelector(s).select(), selector);
                await this._currentBrowser.type(selector, value);
            }, []);
        }
        catch (err) {
            await this._handleCommandError(err, 'setValue');
        }
    }
    async _setFileInputDirect(selector, filePath, options) {
        this._log.verbose(`setFileInput: "${selector}", "${filePath}"`);
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
                // @ts-expect-error FIXME implementation leak, don't use getPage, maybe move setFileInput to BrowserInterface
                const fileChooserPromise = (await this._currentBrowser.getPage()).waitForFileChooser();
                await this._currentBrowser.click(selector);
                await (await fileChooserPromise).accept(filePath);
            }, []);
        }
        catch (err) {
            await this._handleCommandError(err, 'setFileInput');
        }
    }
    /**
     * @param keyCode See https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts
     */
    async _pressKeyDirect(keyCode) {
        this._log.verbose(`pressKey: ${keyCode}`);
        if (arguments.length > 1) {
            throw new TypeError('Selector is removed, pressKey only accepts keyCode.');
        }
        if (typeof keyCode !== 'string') {
            throw new TypeError('Expected string keyCode');
        }
        await this._runBrowserCommandWithRetries('pressKey', [keyCode]);
    }
    async _waitForVisibleDirect(selector, opts = {}) {
        this._log.verbose(`waitForVisible: "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._currentBrowser.waitForVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitForVisible');
        }
    }
    async _waitWhileVisibleDirect(selector, opts = {}) {
        this._log.verbose(`waitWhileVisible: "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._currentBrowser.waitWhileVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err, 'waitWhileVisible');
        }
    }
    async _isVisibleDirect(selector) {
        this._log.verbose(`isVisible: "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            const result = await this._currentBrowser.isVisible(selector);
            return result;
        }
        catch (err) {
            await this._handleCommandError(err, 'isVisible');
        }
    }
    async _focusDirect(selector /* , options*/) {
        this._log.verbose(`focus: "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._currentBrowser.focus(selector);
        }
        catch (err) {
            // TODO handle as error?
            this._log.warn(`WARNING - focus failed - ${err.message}`);
        }
    }
    async _scrollDirect(selector, scrollTop) {
        this._log.verbose(`scroll: ${scrollTop}, "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._currentBrowser.scroll(selector, scrollTop);
        }
        catch (err) {
            await this._handleCommandError(err, 'scroll');
        }
    }
    async _scrollToDirect(selector) {
        this._log.verbose(`scrollTo: "${(0, utils_1.ellipsis)(selector)}"`);
        try {
            await this._currentBrowser.scrollIntoView(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'scrollTo');
        }
    }
    async _mouseoverDirect(selector) {
        this._log.verbose(`mouseover: ${selector}`);
        try {
            this._currentBrowser.hover(selector);
        }
        catch (err) {
            await this._handleCommandError(err, 'mouseover');
        }
    }
    async _execFunctionDirect(fn, ...args) {
        this._log.verbose(`execFunction: ${fn.name || '(anonymous)'}`);
        return this._currentBrowser.execFunction(fn, ...args);
    }
    async _delay(ms) {
        this._log.verbose(`delay ${ms}`);
        return (0, delay_1.default)(ms);
    }
    async _comment(comment) {
        this._log.info(comment);
    }
    async _handleCommandError(err, command) {
        Error.captureStackTrace(err);
        const formattedErrorMessage = `"${command}" command error: ${err.message}\n${getErrorOrigin(err)}`;
        this._log.warn(formattedErrorMessage);
        this._log.verbose(err);
        this._currentTest.runErrors.push(new errors_1.CommandError(formattedErrorMessage));
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
        const fatalErrorScreenshotBitmap = await pnglib_1.default.from(await this._currentBrowser.screenshot());
        await fatalErrorScreenshotBitmap.toPNGFile(path_1.default.resolve(this._conf.workspaceDir, this._currentTest.id + '___fatal.png'));
        if (this._conf.testBailout) {
            throw new errors_1.TestBailoutError(err.stack || err.message);
        }
        if (this._conf.bailout) {
            throw new errors_1.BailoutError(err.stack || err.message);
        }
    }
    async _screenshot(options = {}) {
        options = typeof options === 'string' ? { selector: options } : options;
        const refImgDir = path_1.default.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = path_1.default.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const refImgName = `${this._assertCount}.png`;
        const refImgPath = path_1.default.resolve(refImgDir, refImgName);
        const refImgPathRelative = path_1.default.relative(path_1.default.resolve(this._conf.referenceScreenshotsDir), refImgPath);
        if (this._currentBeforeAssert) {
            await this._currentBeforeAssert(this.directAPI);
        }
        await fs_1.promises.mkdir(refImgDir, { recursive: true });
        let screenshotBitmap = await pnglib_1.default.from(await this._currentBrowser.screenshot({ selector: options.selector, fullPage: options.fullPage }));
        const screenshots = [screenshotBitmap];
        const diffResults = [];
        // region save new ref img
        try {
            await fs_1.promises.access(refImgPath, fs_1.default.constants.F_OK);
        }
        catch (error) {
            await screenshotBitmap.toPNGFile(refImgPath);
            // this._tapWriter.ok(`new reference image added: ${refImgPathRelative}`);
            this._log.info(`new reference image added: ${refImgPathRelative}`);
            await this._runCurrentAfterAssertTasks();
            return;
        }
        // endregion
        const refImg = await pnglib_1.default.from(refImgPath);
        const assertRetryMaxAttempts = this._conf.assertRetryCount + 1;
        let imgDiffResult;
        let formattedPPM;
        for (let assertAttempt = 0; assertAttempt < assertRetryMaxAttempts; assertAttempt++) {
            imgDiffResult = (0, image_diff_1.default)(screenshotBitmap, refImg, this._conf.imageDiffOptions);
            diffResults.push(imgDiffResult);
            formattedPPM = String(imgDiffResult.difference).replace(/\.(\d)\d+/, '.$1');
            if (imgDiffResult.same) {
                // this._tapWriter.ok(`screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, retries: ${assertAttempt}`);
                this._log.verbose(`OK screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, retries: ${assertAttempt}`);
                await this._runCurrentAfterAssertTasks();
                return;
            }
            this._log.verbose(`screenshot assert failed: ${refImgPathRelative}, ppm: ${formattedPPM}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, attempt#: ${assertAttempt}`);
            if (assertAttempt < assertRetryMaxAttempts) {
                screenshotBitmap = await pnglib_1.default.from(await this._currentBrowser.screenshot({ selector: options.selector, fullPage: options.fullPage }));
                screenshots.push(screenshotBitmap);
                await (0, delay_1.default)(this._conf.assertRetryInterval);
            }
        }
        const screenshotError = new errors_1.ScreenshotError(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`);
        screenshotError.message += '\n' + getErrorOrigin(screenshotError);
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
        await fs_1.promises.mkdir(failedImgDir, { recursive: true });
        await fs_1.promises.mkdir(this._conf.referenceDiffsDir, { recursive: true });
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
                this.setExitCode(1);
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
    setExitCode(code) {
        this._log.verbose(`setExitCode: ${code}`);
        process.exitCode = code;
    }
    getTestApiMixinsBound() {
        var _a;
        const tApiMixins = {};
        for (const key of Reflect.ownKeys((_a = this._conf.testApiMixins) !== null && _a !== void 0 ? _a : {})) {
            if (!(typeof this._conf.testApiMixins[key] === 'function')) {
                continue;
            }
            tApiMixins[key] = (...args) => this._conf.testApiMixins[key](this.tAPI, ...args);
        }
        return tApiMixins;
    }
}
exports.default = Testrunner;
function getErrorOrigin(err) {
    if (!err.stack) {
        return '    at (unknown call site)';
    }
    return err.stack.split(/[\r\n]/)
        .slice(1)
        .filter(s => !/testrunner\.js|node_modules[/\\]|<anonymous>|internal/.test(s))
        .join('\n');
}
