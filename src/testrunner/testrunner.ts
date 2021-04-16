const Loggr = require('../../modules/loggr/loggr');
const isEqual = require('lodash.isequal');
const fs = require('fs');
const fsp = require('fs').promises;
const pathlib = require('path');
const util = require('util');
const TapWriter = require('../../modules/tap-writer/index');
const EventEmitter = require('events').EventEmitter;
const mkdirpAsync = util.promisify(require('mkdirp'));
const Bitmap = require('../../modules/pnglib/pnglib').Bitmap;
const globAsync = util.promisify(require('glob'));
const bufferImageDiff = require('../../modules/buffer-image-diff/image-diff').default;
const unsafePrettyMs = require('pretty-ms');
const delay = require('../../modules/delay/delay');

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
    testErrors: []

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

/**
 * test assert API (without before/after side effects, "directAPI"), TODO define
 * @typedef {Object} TestAssertAPIDirect
 */

/**
 * @callback BeforeAfterCommandCallback
 * @param {TestAssertAPIDirect} t
 * @param {Object} command - command before/after this callback
 */

/**
 * @callback DirectAPICallback
 * @param {TestAssertAPIDirect} t
 */

/**
 * @callback TestrunnerCallback
 * @param {Testrunner} testrunner
 */

/**
 * @typedef {Object} Suite
 * @property {String} name
 * @property {String} appUrl
 * @property {Array<String>} testFiles - relative/absolute paths and/or globs
 * @property {Function} [beforeSuite]
 * @property {Function} [afterSuite]
 * @property {Function} [beforeTest]
 * @property {Function} [afterTest]
 * @property {BeforeAfterCommandCallback} [beforeCommand]
 * @property {BeforeAfterCommandCallback} [afterCommand]
 * @property {DirectAPICallback} [afterLastCommand]
 * @property {DirectAPICallback} [beforeAssert]
 * @property {DirectAPICallback} [afterAssert]
 */

/**
 * @typedef {Object} screenshotItem
 * @property {{ path: string, relativePath: string }} errorImage
 * @property {{ path: string, relativePath: string }} diffImage
 * @property {{ path: string, relativePath: string }} referenceImage
 * @property {number} attempt
 * @property {number} assertIndex
 * @property {string} testName
 */

/**
 * @typedef {Object} TestRunReport
 * @property {screenshotItem[]} screenshots
 * @property {number} testsCount
 * @property {number} passedCount
 * @property {number} failedCount
 * @property {string[]} failedTestNames
 * @property {number} runTimeMs
 * @property {Object<string, number>} runtimes
 * @property {boolean} passed
 */

/**
 * @typedef {Object} TestrunnerConfig
 * @property {Number|String} [logLevel] - See Logger.LEVELS
 * @property {Boolean} [testBailout = true] - Bailout from a single test if an assert fails
 * @property {Boolean} [bailout = false] - Bailout from the entire test program if an assert fails
 * @property {String} [referenceScreenshotsDir = DEFAULT_REF_SCREENSHOTS_DIR]
 * @property {String} [referenceErrorsDir = DEFAULT_REF_ERRORS_DIR]
 * @property {string} [workspaceDir]
 * @property {Array<import('../../modules/browsers/browser-interface')>} browsers
 * @property {import('../../modules/buffer-image-diff/image-diff').ImageDiffOptions} [imageDiffOptions] - options for the built-in, screenshot-based asserter
 * @property {Array<Suite>} suites
 * @property {Number} [assertRetryCount = 0]
 * @property {Number} [assertRetryInterval = 1000]
 * @property {String} [testFilter] - regular expression string
 * @property {import('stream').Writable} [outStream]
 * @property {Number} [testRetryCount = 0] - retry failed tests n times
 * @property {RegExp} [testRetryFilter = /.+/] - retry failed tests only if test name matches this filter
 * @property {number} [commandRetryCount = 4]
 * @property {number} [commandRetryInterval = 250]
 * @property {TestrunnerCallback} [onCommandError]
 * @property {TestrunnerCallback} [onAssertError]
 * @property {number} [exitTimeout = 300000]
 */

class Testrunner extends EventEmitter {
    /**
     * @param {TestrunnerConfig} conf
     */
    constructor(conf) {
        super();

        const defaultConf = {
            logLevel: Loggr.LEVELS.INFO,
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

        this._log = new Loggr({
            logLevel: this._conf.logLevel,
            showTime: true,
            namespace: 'Testrunner',
            indent: '  ',
            outStream: this._conf.outStream,
        });

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

        this._tapWriter = new TapWriter({
            outStream: this._conf.outStream,
        });

        this._inBailout = false;

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

        this._consolePipeLog = new Loggr({
            logLevel: this._conf.logLevel,
            showTime: true,
            namespace: 'ConsolePipe',
            indent: '  ',
            outStream: this._conf.outStream,
        });

        this._assertCount = 0;

        /** @type {import('../../modules/browsers/browser-interface').IBrowser} */
        this._currentBrowser = null;
        this._foundTestsCount = 0;
        this._okTestsCount = 0;

        /**
         * @type {TestRunReport}
         */
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
            this._tapWriter.version();

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
            this._log.error(error.stack || error.message || error);
        }
        finally {
            // TODO run time, TAP msg
            this._log.info(`finished in ${prettyMs(Date.now() - runStartTime, { verbose: true })}`);

            const effectiveTestsCount = this._foundTestsCount * this._conf.browsers.length;

            this._tapWriter.diagnostic(`1..${effectiveTestsCount}`);
            this._tapWriter.diagnostic(`tests ${effectiveTestsCount}`);
            this._tapWriter.diagnostic(`pass ${this._okTestsCount}`);

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

                this._tapWriter.diagnostic('---');
                failedTestNames.forEach(name => this._tapWriter.diagnostic('[FAIL] ' + name));
                this._tapWriter.diagnostic('---');

                this._tapWriter.diagnostic('FAILURE');
            }
            else {
                this._tapWriter.diagnostic('SUCCESS');
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
                    this._log.trace('running beforeSuite');
                    await suite.beforeSuite();
                    this._log.trace('completed beforeSuite');
                }

                await this._runSuite(suite);
            }
            finally {
                if (suite.afterSuite) {
                    this._log.trace('running afterSuite');

                    try {
                        await suite.afterSuite();
                        this._log.trace('completed afterSuite');
                    }
                    catch (error) {
                        this._log.error('error while running afterSuite: ', error);
                    }
                }
            }
        }
    }

    async _runSuite(suite) {
        this._log.info(`running suite: ${suite.name || DEFAULT_SUITE_NAME}`);

        for (const test of suite.tests) {
            if (this._isAborting) {
                throw new AbortError();
            }

            try {
                this._tapWriter.diagnostic(test.name);
                await this._runTestWithRetries({ suite, test });
                this._tapWriter.ok(`${test.name} (${prettyMs(this._testRunReport.runtimes[test.name])})`);
                this._okTestsCount++;
            }
            catch (error) {
                this._tapWriter.notOk(`${test.name} (${prettyMs(this._testRunReport.runtimes[test.name])})`);
                this._log.error(error);
            }
        }
    }

    async _runTestWithRetries({ suite, test }) {
        this._log.trace(`_runTestWithRetries: started for test: '${test.name}'`);

        const maxAttempts = this._conf.testRetryFilter.test(test.name) ? this._conf.testRetryCount + 1 : 1;

        this._log.trace(`_runTestWithRetries: maxAttempts = ${maxAttempts}`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this._log.trace(`_runTestWithRetries loop: attempt = ${attempt}`);

            try {
                await this._runTest({ suite, test });

                // cleanup: remove potential failed screenshots from catalog for this test
                // TODO delete screenshots from disk? or don't write them until test fails
                this._testRunReport.screenshots = this._testRunReport.screenshots.filter(screenshotItem => screenshotItem.testName !== test.name);

                this._log.trace(`_runTestWithRetries: success, test '${test.name}' passed`);
                break;
            }
            catch (error) {
                this._log.error('_runTestWithRetries: error when running _runTest:');
                this._log.error(error);

                if (attempt === maxAttempts) {
                    throw error;
                }

                this._log.info(`test "${test.name}" failed, retrying`);

                if (error.testErrors && error.testErrors.length > 0) {
                    this._log.debug(error.testErrors.map(String).join('\n'));
                }
            }
        }
    }

    async _runTest({ suite, test }) {
        this._log.trace(`_runTest: running test ${test.name}`);

        const browser = this._currentBrowser;

        this._log.info(`starting browser "${browser.name}"`);
        await browser.start();

        try {
            if (suite.beforeTest) {
                this._log.trace('running beforeTest');
                await suite.beforeTest(this.directAPI);
                this._log.trace('completed beforeTest');
            }

            await this._runTestCore({ suite, test });
        }
        finally {
            if (suite.afterTest) {
                this._log.trace('running afterTest');

                try {
                    await suite.afterTest(this.directAPI, { test });
                }
                catch (error) {
                    this._log.error('error while running afterTest: ', error);
                }

                this._log.trace('completed afterTest');
            }

            try {
                await browser.stop();
            }
            catch (error) {
                this._log.error('error while stopping browser: ', error);
            }
        }
    }

    /**
     * @param {Object} options
     * @param  {Object} options.suite
     * @param  {Object} options.test
     * @throws {}
     */
    async _runTestCore({ suite, test }) {
        this._log.trace(`_runTestCore: running test ${test.name}`);

        this._currentTest = test;
        this._assertCount = 0;

        test.runErrors = [];
        test.state = TEST_STATE.SCHEDULED;

        let testStartTime;

        await this._currentBrowser.navigateTo(suite.appUrl);

        if (suite.beforeFirstCommand) {
            await suite.beforeFirstCommand(this.directAPI);
        }

        this._currentBeforeCommand = suite.beforeCommand || noop;
        this._currentAfterCommand = suite.afterCommand || noop;
        this._currentBeforeAssert = suite.beforeAssert || noop;
        this._currentAfterAssert = suite.afterAssert || noop;

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
            this._log.error(error);

            // TODO this seems incorrect, should throw TestFailedError from the original places
            throw new TestFailedError({
                message: error.message,
            });
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

    /**
     * @typedef {Object} Test
     * @property {String} id
     * @property {String} name
     * @property {Function} testFn
     */

    /**
     * @param {Array<String>} testFilePaths
     * @return {Promise<Test[]>}
     */
    async _parseTestFiles(testFilePaths) {
        const tests = [];

        function testRegistrar(arg0, arg1) {
            let name, testFn;

            if (arg1 === undefined) {
                name = DEFAULT_TEST_NAME;
                testFn = arg0;
            }
            else {
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

    _wrapFunctionWithSideEffects(fn, cmdType) {
        return async (...args) => {
            if (this._isAborting) {
                throw new AbortError();
            }

            await this._currentBeforeCommand(this.directAPI, { type: cmdType });
            const fnResult = await fn(...args);
            await this._currentAfterCommand(this.directAPI, { type: cmdType });
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
            await this._execCommandsDirect(cmd);
        }
    }

    async _execCommandsSideEffect(cmds) {
        for (const cmd of cmds) {
            await this._execCommandSideEffect(cmd);
        }
    }


    async _runBrowserCommandWithRetries(browserFnName: string | Function, args?: any[]) {
        let retries = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
            this._log.trace(`_execCommandWithRetries - attempt: ${retries}, command: ${browserFnName}, args: ${util.inspect(args)}`);

            try {
                if (typeof browserFnName === 'function') {
                    await browserFnName();
                }
                else {
                    await this._currentBrowser[browserFnName](...args);
                }

                this._log.trace('_execCommandWithRetries - success');
                break;
            }
            catch (err) {
                if (retries < this._conf.commandRetryCount) {

                    if (typeof browserFnName === 'string') {
                        this._log.warn(`Command error, retrying "${browserFnName}"`);
                    }
                    else {
                        this._log.warn('Command error, retrying');
                    }

                    this._log.debug(err);
                    retries++;
                    await delay(this._conf.commandRetryInterval);
                    continue;
                }

                this._log.trace('_execCommandWithRetries - failure, max retries reached');

                throw err;
            }
        }
    }

    _equal(actual, expected, description) {
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

    async _clickDirect(selector/* , options*/) {
        this._log.info(`click: "${ellipsis(selector)}"`);

        try {
            await this._runBrowserCommandWithRetries('click', [selector]);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _getValueDirect(selector) {
        this._log.info(`getValue: "${ellipsis(selector)}"`);

        return this._currentBrowser.getValue(selector);
    }

    async _setValueDirect(selector, value) {
        this._log.info(`setValue: "${ellipsis(value)}", "${ellipsis(selector)}"`);

        try {
            await this._runBrowserCommandWithRetries(async () => {
                // @ts-expect-error
                await this._currentBrowser.execFunction((s) => document.querySelector(s).select(), selector);
                await this._currentBrowser.type(selector, value);
            });
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _setFileInputDirect(selector, filePath, options?: { waitForVisible?: boolean, checkSelectorType?: boolean }) {
        this._log.info(`setFileInput: "${selector}", "${filePath}"`);

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

                // FIXME implementation leak, don't use _page, maybe move setFileInput to BrowserInterface
                const fileChooserPromise = this._currentBrowser._page.waitForFileChooser();
                await this._currentBrowser.click(selector);
                await (await fileChooserPromise).accept([filePath]);
            });
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    /**
     * @param {string} keyCode See https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts
     * @return {Promise<void>}
     */
    async _pressKeyDirect(keyCode) {
        this._log.info(`pressKey: ${keyCode}`);

        if (arguments.length > 1) {
            throw new TypeError('Selector is removed, pressKey only accepts keyCode.');
        }

        if (typeof keyCode !== 'string') {
            throw new TypeError('Expected string keyCode');
        }

        await this._runBrowserCommandWithRetries('pressKey', [keyCode]);
    }

    async _waitForVisibleDirect(selector, opts = {}) {
        this._log.info(`waitForVisible: "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.waitForVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _waitWhileVisibleDirect(selector, opts = {}) {
        this._log.info(`waitWhileVisible: "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.waitWhileVisible(selector, opts);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _isVisibleDirect(selector) {
        try {
            const result = await this._currentBrowser.isVisible(selector);
            return result;
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _focusDirect(selector /* , options*/) {
        this._log.info(`focus: "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.focus(selector);
        }
        catch (err) {
            // TODO handle as error?
            this._log.warn(`WARNING - focus failed - ${err.message}`);
        }
    }

    async _scrollDirect(selector, scrollTop) {
        this._log.debug(`scroll: ${scrollTop}, "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.scroll(selector, scrollTop);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _scrollToDirect(selector) {
        this._log.debug(`scrollTo: "${ellipsis(selector)}"`);

        try {
            await this._currentBrowser.scrollIntoView(selector);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _mouseoverDirect(selector) {
        this._log.debug(`mouseover: ${selector}`);

        try {
            this._currentBrowser.hover(selector);
        }
        catch (err) {
            await this._handleCommandError(err);
        }
    }

    async _execFunctionDirect(fn, ...args) {
        this._log.debug(`execFunction: ${fn.name || '(anonymous)'}`);

        return this._currentBrowser.execFunction(fn, ...args);
    }

    async _delay(ms) {
        this._log.debug(`delay ${ms}`);
        return delay(ms);
    }

    async _comment(comment) {
        this._tapWriter.comment(comment);
    }

    async _handleCommandError(err) {
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

    async _assert() {
        const refImgDir = pathlib.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = pathlib.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);

        const refImgName = `${this._assertCount}.png`;
        const refImgPath = pathlib.resolve(refImgDir, refImgName);
        const refImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceScreenshotsDir), refImgPath);

        await this._currentBeforeAssert(this.directAPI);
        await mkdirpAsync(refImgDir);

        let screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot());

        const screenshots = [screenshotBitmap];
        const diffResults = [];

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
                this._log.info(`OK screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, retries: ${assertAttempt}`);

                await this._runCurrentAfterAssertTasks();
                return;
            }

            this._log.warn(`screenshot assert failed: ${refImgPathRelative}, ppm: ${formattedPPM}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}, attempt#: ${assertAttempt}`);

            if (assertAttempt < assertRetryMaxAttempts) {
                screenshotBitmap = await Bitmap.from(await this._currentBrowser.screenshot());

                screenshots.push(screenshotBitmap);
                await delay(this._conf.assertRetryInterval);
            }
        }

        this._currentTest.runErrors.push(new AssertError(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`));

        this._log.error(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`);

        if (this._conf.onAssertError !== null) {
            try {
                await this._conf.onAssertError(this);
            }
            catch (error) {
                this._log.error('onAssertError error');
                this._log.error(error);
            }
        }

        await mkdirpAsync(failedImgDir);
        await mkdirpAsync(this._conf.referenceDiffsDir);

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
        try {
            await this._currentAfterAssert(this.directAPI);
        }
        catch (error) {
            this._log.trace('_runCurrentAfterAssert catch');
            this._log.error(error.stack || error.message);
            process.exitCode = 1;
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

function noop() { }

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

function prettyMs(ms, opts?) {
    return typeof ms === 'number' && ms >= 0 ? unsafePrettyMs(ms, opts) : '? ms';
}

Testrunner.AbortError = AbortError;
Testrunner.AssertError = AssertError;

export default Testrunner;
