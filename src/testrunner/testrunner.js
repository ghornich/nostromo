const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
Promise.config({ longStackTraces: true });
const Loggr = require(MODULES_PATH + 'loggr');
const isEqual = require('lodash.isequal');
// const Schema = require('schema-inspector');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const util = require('util');
const TapWriter = require(MODULES_PATH + 'tap-writer');
const EventEmitter = require('events').EventEmitter;
const BrowserPuppeteer = require(MODULES_PATH + 'browser-puppeteer').BrowserPuppeteer;
const MESSAGES = require(MODULES_PATH + 'browser-puppeteer').MESSAGES;
const screenshotMarkerImg = require(MODULES_PATH + 'browser-spawner-base/screenshot-marker');
const screenshotjs = require(MODULES_PATH + 'screenshot-js');
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const PNG = require('pngjs').PNG;
const globAsync = Promise.promisify(require('glob'));
const bufferImageDiff = require(MODULES_PATH + 'buffer-image-diff');
const rimrafAsync = Promise.promisify(require('rimraf'));
const accessAsync = util.promisify(fs.access);

// TODO standard tape API (sync), rename current equal() to valueEquals()
// TODO convert to es6 class

const CONF_SCHEMA = {
    type: 'object',
    properties: {
        // appUrl: {
        //     type: ['string', 'object'],
        //     // pattern: /^(http:\/\/|file:\/\/\/?)[^ ]+$/,
        // },
        testPort: {
            type: 'number',
            optional: true,
        },
        // testFiles: {
        //     type: ['string', 'array'],
        // },
        browsers: {
            type: ['function', 'array'],
        },
        logLevel: {
            type: 'number',
            optional: true,
        },
        // bailout: {
        //     type: 'boolean',
        //     optional: true,
        // },



    },
};

const DEFAULT_TEST_PORT = 47225;
const DEFAULT_TEST_NAME = '(Unnamed test)';

const ELLIPSIS_LIMIT = 40;

const DEFAULT_SUITE_NAME = '(Unnamed suite)';

const DEFAULT_REF_SCREENSHOTS_DIR = 'reference-screenshots';
const DEFAULT_REF_ERRORS_DIR = 'reference-errors';
const DEFAULT_REF_DIFFS_DIR = 'reference-diffs';

// TODO use es6 class to inherit Error
const ERRORS = {
    TIMEOUT: 0,
    NOT_EQUAL: 1,
    TEST_BAILOUT: 2,
    BAILOUT: 3,
};

class AssertError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AssertError';
    }
}

class AbortError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AbortError';
    }
}

class TestFailedError extends Error {
    constructor({ message, testErrors }) {
        super(message);
        this.testErrors = testErrors || [];
        this.name = 'TestFailedError';
    }
}

/**
 * test assert API (without before/after side effects, "directAPI"), TODO define
 * @typedef {Object} TestAssertAPIDirect
 */

/**
 * @callback BeforeAfterCommandCallback
 * @param {TestAssertAPIDirect} t
 * @param {Command} command - command before/after this callback
 */

/**
 * @callback DirectAPICallback
 * @param {TestAssertAPIDirect} t
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
 * @typedef {Object} TestrunnerConfig
 * @property {Number} [testPort = 47225]
 * @property {Number|String} [logLevel] - See Logger.LEVELS
 * @property {Boolean} [testBailout = true] - Bailout from a single test if an assert fails
 * @property {Boolean} [bailout = false] - Bailout from the entire test program if an assert fails
 * @property {String} [referenceScreenshotsDir = DEFAULT_REF_SCREENSHOTS_DIR]
 * @property {String} [referenceErrorsDir = DEFAULT_REF_ERRORS_DIR]
 * @property {Array<BrowserSpawner>} browsers - see example run config file
 * @property {ImageDiffOptions} [imageDiffOptions] - options for the built-in, screenshot-based asserter
 * @property {Array<Suite>} suites
 * @property {Number} [assertRetryCount = 0]
 * @property {Number} [assertRetryInterval = 1000]
 * @property {String} [testFilter] - regular expression string
 * @property {Number} [testRetryCount = 0] - retry failed tests n times
 * @property {RegExp} [testRetryFilter = /.+/] - retry failed tests only if test name matches this filter
 */

class Testrunner extends EventEmitter {
    /**
     * @param {TestrunnerConfig} conf
     */
    constructor(conf) {
        super();

        const defaultConf = {
            testPort: DEFAULT_TEST_PORT,
            logLevel: Loggr.LEVELS.INFO,
            testBailout: true,
            bailout: false,
            referenceScreenshotsDir: DEFAULT_REF_SCREENSHOTS_DIR,
            referenceErrorsDir: DEFAULT_REF_ERRORS_DIR,
            referenceDiffsDir: DEFAULT_REF_DIFFS_DIR,
            browsers: [],
            suites: [],
            testFilter: null, // TODO use regex instead of string
            outStream: process.stdout,
            assertRetryCount: 0,
            assertRetryInterval: 1000,
            testRetryCount: 0,
            testRetryFilter: /.+/,
        };

        const defaultImageDiffOptions = {
            colorThreshold: 3,
            imageThreshold: 20,
            includeDiffBufferIndexes: true,
        };

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

        if (!__isArray(this._conf.browsers)) {
            this._conf.browsers = [this._conf.browsers];
        }

        // '_execFn,equal,click,setValue,waitForVisible,waitWhileVisible'.split(',').forEach(fnn=>{
        //     this[fnn]=this[fnn].bind(this)
        // })

        this.directAPI = {
            getValue: this._getValueDirect.bind(this),
            setValue: this._setValueDirect.bind(this),
            click: this._clickDirect.bind(this),
            waitForVisible: this._waitForVisibleDirect.bind(this),
            waitWhileVisible: this._waitWhileVisibleDirect.bind(this),
            isVisible: this._isVisibleDirect.bind(this),
            focus: this._focusDirect.bind(this),
            scroll: this._scrollDirect.bind(this),
            delay: this._delay.bind(this),
            comment: this._comment.bind(this),
            assert: this._assert.bind(this),
            pressKey: this._pressKeyDirect.bind(this),
            composite: this._compositeDirect.bind(this),
            mouseover: this._mouseoverDirect.bind(this),
            execFunction: this._execFunctionDirect.bind(this),
            uploadFileAndAssign: this._uploadFileAndAssignDirect.bind(this),
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

        this._browserPuppeteer = new BrowserPuppeteer({
            logger: this._log.fork('BrowserPuppeteer'),
            deferredMessaging: true,
        });

        this._consolePipeLog = new Loggr({
            logLevel: this._conf.logLevel,
            showTime: true,
            namespace: 'ConsolePipe',
            indent: '  ',
            outStream: this._conf.outStream,
        });

        this._browserPuppeteer.on(MESSAGES.UPSTREAM.CONSOLE_PIPE, consolePipeMessage => {
            this._consolePipeLog.debug(consolePipeMessage.messageType + ': ' + consolePipeMessage.message);
        });

        this._assertCount = 0;
        this._currentBrowser = null;
        this._foundTestsCount = 0;
        this._okTestsCount = 0;
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

            // TODO nem ennek a felelossege?
            await rimrafAsync(conf.referenceErrorsDir);
            await rimrafAsync(conf.referenceDiffsDir);

            await this._parseSuiteTestfiles();
            this._foundTestsCount = conf.suites.reduce((accum, test) => accum + test.tests.length, 0);
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

            await this._browserPuppeteer.start();

            try {
                await this._runBrowsers();
            }
            finally {
                await this._browserPuppeteer.stop();
            }

        }
        catch (error) {
            process.exitCode = 1;
            this._log.error(error.stack || error.message || error);
        }
        finally {
            // TODO run time, TAP msg
            this._log.info(`finished in ${formatDuration(Math.floor((Date.now() - runStartTime) / 1000))}`);

            const effectiveTestsCount = this._foundTestsCount * this._conf.browsers.length;

            this._tapWriter.diagnostic(`1..${effectiveTestsCount}`);
            this._tapWriter.diagnostic(`tests ${effectiveTestsCount}`);
            this._tapWriter.diagnostic(`pass ${this._okTestsCount}`);

            if (effectiveTestsCount !== this._okTestsCount) {
                process.exitCode = 1;
                this._tapWriter.diagnostic('FAILURE');
            }
            else {
                this._tapWriter.diagnostic('SUCCESS');
            }

            this._isRunning = false;
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
            await Promise.delay(500);
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
                this._tapWriter.ok(test.name);
                this._okTestsCount++;
            }
            catch (error) {
                this._tapWriter.notOk(test.name);
                this._log.error(error);
            }
        }
    }

    async _runTestWithRetries({ suite, test }) {
        this._log.trace(`_runTestWithRetries: started for test: '${ test.name }'`);

        const maxAttempts = this._conf.testRetryFilter.test(test.name) ? this._conf.testRetryCount + 1 : 1;

        this._log.trace(`_runTestWithRetries: maxAttempts = ${ maxAttempts }`);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            this._log.trace(`_runTestWithRetries loop: attempt = ${ attempt }`);

            try {
                await this._runTest({ suite, test });
                this._log.trace(`_runTestWithRetries: success, test '${ test.name }' passed`);
                break;
            }
            catch (error) {
                this._log.error(`_runTestWithRetries: error when running _runTest:`);
                this._log.error(error);

                if (attempt === maxAttempts || !(error instanceof TestFailedError)) {
                    throw error;
                }

                this._log.info(`test "${test.name}" failed, retrying`);
                this._log.debug(error.testErrors.map(String).join('\n'));
            }
        }
    }

    async _runTest({ suite, test }) {
        this._log.trace(`_runTest: running test ${ test.name }`);

        var browser = this._currentBrowser;

        this._log.info(`starting browser "${browser.name}" from "${browser.path}"`);
        await browser.start();
        await browser.waitForBrowserVisible();

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
                    await suite.afterTest(this.directAPI);
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
     * @param  {Object} options.suite
     * @param  {Object} options.test
     * @throws {}
     */
    async _runTestCore({ suite, test }) {
        this._log.trace(`_runTestCore: running test ${ test.name }`);

        this._currentTest = test;
        this._assertCount = 0;

        test.runErrors = [];

        try {
            await this._currentBrowser.open(suite.appUrl);
            await this._browserPuppeteer.waitForConnection();

            if (suite.beforeFirstCommand) {
                await suite.beforeFirstCommand(this.directAPI);
            }

            this._currentBeforeCommand = suite.beforeCommand || noop;
            this._currentAfterCommand = suite.afterCommand || noop;
            this._currentBeforeAssert = suite.beforeAssert || noop;
            this._currentAfterAssert = suite.afterAssert || noop;

            try {
                await test.testFn(this.tAPI, { directAPI: this.directAPI });

                if (test.runErrors.length > 0) {
                    throw new TestFailedError({
                        message: `Test "${test.name}" failed`,
                        testErrors: test.runErrors,
                    });
                }
            }
            catch (error) {
                this._log.error(error);

                // TODO this seems incorrect, should throw TestFailedError from the original places
                throw new TestFailedError({
                    message: error.message
                });
            }
            finally {
                if (suite.afterLastCommand) {
                    await suite.afterLastCommand(this.directAPI);
                }
            }
        }
        finally {
            await this._browserPuppeteer.clearPersistentData();
            await this._browserPuppeteer.closeConnection();
            await this._currentBrowser.open('');
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
     * @return {Array<Test>}
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
        return Promise.each(cmds, cmd => this._execCommandDirect(cmd));
    }

    async _execCommandsSideEffect(cmds) {
        return Promise.each(cmds, cmd => this._execCommandSideEffect(cmd));
    }

    async _equal(actual, expected, description) {
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

    async _clickDirect(selector) {
        this._log.info(`click: "${ellipsis(selector)}"`);

        try {
            await this._browserPuppeteer.execCommand({
                type: 'click',
                selector: selector,
            });
        }
        catch (err) {
            this._handleCommandError(err);
        }
    }

    // TODO wtf is this? use _getValueDirect?
    async _getValue(selector) {
        return this._browserPuppeteer.execCommand({
            type: 'getValue',
            selector: selector,
        });
    }

    async _getValueDirect(selector) {
        this._log.info(`getValue: "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'getValue',
            selector: selector,
        });
    }

    async _setValueDirect(selector, value) {
        this._log.info(`setValue: "${ellipsis(value)}", "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'setValue',
            selector: selector,
            value: value,
        })
        .catch(err => {
            this._handleCommandError(err);
        });
    }

    async _pressKeyDirect(selector, keyCode) {
        this._log.info(`pressKey: ${keyCode}, "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'pressKey',
            selector: selector,
            keyCode: keyCode,
        });
    }

    async _waitForVisibleDirect(selector, opts = {}) {
        this._log.info(`waitForVisible: "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'waitForVisible',
            selector: selector,
            pollInterval: opts.pollInterval,
            timeout: opts.timeout,
        })
        .catch(err => {
            this._handleCommandError(err);
        });
    }

    async _waitWhileVisibleDirect(selector, opts = {}) {
        this._log.info(`waitWhileVisible: "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'waitWhileVisible',
            selector: selector,
            pollInterval: opts.pollInterval,
            initialDelay: opts.initialDelay,
            timeout: opts.timeout,
        })
        .catch(err => {
            this._handleCommandError(err);
        });
    }

    async _isVisibleDirect(selector) {
        return this._browserPuppeteer.execCommand({
            type: 'isVisible',
            selector: selector,
        })
        .catch(err => {
            // this._tapWriter.notOk(`isVisible - ${err.message}`);

            this._handleCommandError(err);
        });
    }

    async _focusDirect(selector) {
        this._log.info(`focus: "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'focus',
            selector: selector,
        })
        .catch(err => {
            // TODO handle as error?
            this._log.warn(`WARNING - focus - ${err.message}`);

            // this._handleCommandError(err);
        });
    }

    async _scrollDirect(selector, scrollTop) {
        this._log.debug(`scroll: ${scrollTop}, "${ellipsis(selector)}"`);

        return this._browserPuppeteer.execCommand({
            type: 'scroll',
            selector: selector,
            scrollTop: scrollTop,
        })
        .catch(err => {
            this._handleCommandError(err);
        });
    }

    async _compositeDirect(commands) {
        this._log.debug(`composite: ${commands.map(cmd => cmd.type).join(', ')}`);

        return this._browserPuppeteer.execCommand({
            type: 'composite',
            commands: commands,
        })
        .catch(err => {
            // this._tapWriter.notOk(`composite - ${err.message}`);

            this._handleCommandError(err);
        });
    }

    async _mouseoverDirect(selector) {
        this._log.debug(`mouseover: ${selector}`);

        return this._browserPuppeteer.execCommand({
            type: 'mouseover',
            selector: selector,
        })
        .catch(err => {
            // this._tapWriter.notOk(`mouseover - ${err.message}`);

            this._handleCommandError(err);
        });
    }

    async _execFunctionDirect(fn, ...args) {
        this._log.debug(`execFunction: ${fn.name || '(anonymous)'}`);

        return this._browserPuppeteer.execFunction(fn, ...args);
    }

    async _delay(ms) {
        this._log.debug(`delay ${ms}`);
        return Promise.delay(ms);
    }

    async _comment(comment) {
        this._tapWriter.comment(comment);
    }

    _handleCommandError(err) {
        if (this._conf.testBailout) {
            throw createError(ERRORS.TEST_BAILOUT, err.message);
        }

        if (this._conf.bailout) {
            throw createError(ERRORS.BAILOUT, err.message);
        }
    }

    // TODO remove sync codes
    async _assert() {
        const refImgDir = pathlib.resolve(this._conf.referenceScreenshotsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);
        const failedImgDir = pathlib.resolve(this._conf.referenceErrorsDir, this._currentBrowser.name.toLowerCase(), this._currentTest.id);

        const refImgName = `${this._assertCount}.png`;
        const refImgPath = pathlib.resolve(refImgDir, refImgName);
        const refImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceScreenshotsDir), refImgPath);

        await this._currentBeforeAssert(this.directAPI);
        await mkdirpAsync(refImgDir);

        let screenshotImg = await screenshotjs({ cropMarker: screenshotMarkerImg });
        let screenshots = [screenshotImg];
        let diffResults = [];

        // region save new ref img
        try {
            await accessAsync(refImgPath, fs.constants.F_OK);
        }
        catch (error) {
            const png = new PNG(screenshotImg);
            png.data = screenshotImg.data;
            const pngFileBin = PNG.sync.write(png);

            fs.writeFileSync(refImgPath, pngFileBin);

            // this._tapWriter.ok(`new reference image added: ${refImgPathRelative}`);
            this._log.info(`new reference image added: ${refImgPathRelative}`);

            await this._runCurrentAfterAssertTasks();
            return;
        }
        // endregion

        const refImg = PNG.sync.read(fs.readFileSync(refImgPath));

        const assertRetryMaxAttempts = this._conf.assertRetryCount + 1;
        let imgDiffResult;
        let formattedPPM;

        for (let assertAttempt = 0; assertAttempt < assertRetryMaxAttempts; assertAttempt++) {
            imgDiffResult = bufferImageDiff(screenshotImg, refImg, this._conf.imageDiffOptions);
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
                screenshotImg = await screenshotjs({ cropMarker: screenshotMarkerImg });
                screenshots.push(screenshotImg);
                await Promise.delay(this._conf.assertRetryInterval);
            }
        }

        this._currentTest.runErrors.push(new AssertError(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`));

        this._log.error(`FAIL screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}, totalChangedPixels: ${imgDiffResult.totalChangedPixels}`);

        // this._tapWriter.notOk(`screenshot assert (${formattedPPM} ppm): ${refImgPathRelative}`);

        await mkdirpAsync(failedImgDir);
        await mkdirpAsync(this._conf.referenceDiffsDir);

        // region write failed images
        for (const [i, image] of screenshots.entries()) {
            const failedImgName = `${this._assertCount}__attempt_${i+1}.png`;
            const failedImgPath = pathlib.resolve(failedImgDir, failedImgName);
            const failedImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceErrorsDir), failedImgPath);
            const failedPng = new PNG(image);
            failedPng.data = image.data;
            const failedImgBin = PNG.sync.write(failedPng);
            fs.writeFileSync(failedImgPath, failedImgBin);
            this._log.info(`failed screenshot added: ${failedImgPathRelative}`);
        }
        // endregion

        // region write diff images
        for (const [i, diffResult] of diffResults.entries()) {
            const image = screenshots[i];

            const diffImgPath = pathlib.resolve(
                this._conf.referenceDiffsDir,
                this._currentBrowser.name.toLowerCase() + '___' + this._currentTest.id + '___' + this._assertCount + `__attempt_${i+1}.png`
            );
            const diffImgPathRelative = pathlib.relative(pathlib.resolve(this._conf.referenceDiffsDir), diffImgPath);

            for (const bufIdx of diffResult.diffBufferIndexes) {
                image.data[bufIdx] = 255;
                image.data[bufIdx + 1] = 0;
                image.data[bufIdx + 2] = 0;
            }

            const diffPng = new PNG(image);
            diffPng.data = image.data;
            const diffImgBin = PNG.sync.write(diffPng);
            fs.writeFileSync(diffImgPath, diffImgBin);
            this._log.info(`diff screenshot added: ${diffImgPathRelative}`);
        }
        // endregion

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

    async _uploadFileAndAssignDirect(data) {
        const filePath = data.filePath;
        const fileName = pathlib.basename(filePath);
        const destinationVariable = data.destinationVariable;

        const file = await fs.readFileAsync(filePath);
        const fileBase64 = file.toString('base64');

        return this._browserPuppeteer.execCommand({
            type: 'uploadFileAndAssign',
            fileData: {
                base64: fileBase64,
                name: fileName,
                type: data.type,
            },
            destinationVariable: destinationVariable,
        });
    }
}

function noop() {}

function __toString(v) {
    return Object.prototype.toString.call(v);
}
function __isArray(v) {
    return __toString(v) === '[object Array]';
}

// TODO use es6 classes for errors
function createError(type, msg) {
    const e = new Error(msg); e.type = type; return e;
}

function ellipsis(s, l = ELLIPSIS_LIMIT) {
    if (s.length <= l) {
        return s;
    }

    return `${s.substr(0, l - 3)}...`;
}

function multiGlobAsync(globs) {
    let paths = [];

    return Promise.each(globs, glob => {
        return globAsync(glob)
        .then(results => {
            paths = paths.concat(results);
        });
    })
    .then(() => paths);
}

function formatDuration(val) {
    if (val < 60) {
        return `${val}s`;
    }
    else if (val >= 60 && val < 60 * 60) {
        const m = Math.floor(val / 60);
        const s = val - m * 60;

        return `${m}m ${s}s`;
    }

    const h = Math.floor(val / 60 / 60);
    const m = Math.floor((val - h * 60 * 60) / 60);
    const s = val - m * 60 - h * 60 * 60;

    return `${h}h ${m}m ${s}s`;

}

function getIdFromName(name) {
    return name.replace(/[^a-z0-9()._-]/gi, '_');
}

exports = module.exports = Testrunner;
Testrunner.AbortError = AbortError;
Testrunner.AssertError = AssertError;
