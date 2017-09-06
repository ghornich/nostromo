const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
Promise.config({ longStackTraces: true });
const Loggr = require(MODULES_PATH + 'loggr');
const isEqual = require('lodash.isequal');
const Schema = require('schema-inspector');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const urllib = require('url');
const util = require('util');
const TapWriter = require(MODULES_PATH + 'tap-writer');
const EventEmitter = require('events').EventEmitter;
const BrowserPuppeteer = require(MODULES_PATH + 'browser-puppeteer').BrowserPuppeteer;
const MESSAGES = require(MODULES_PATH + 'browser-puppeteer').MESSAGES;
const cropMarkerImg = require(MODULES_PATH + 'browser-puppeteer').SCREENSHOT_MARKER;
const screenshotjs = require(MODULES_PATH + 'screenshot-js');
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const PNG = require('pngjs').PNG;
const globAsync = Promise.promisify(require('glob'));
const bufferImageSearch = require(MODULES_PATH + 'buffer-image-search');
const bufferImageDiff = require(MODULES_PATH + 'buffer-image-diff');
const rimrafAsync = Promise.promisify(require('rimraf'));


// TODO standard tape API (sync), rename current equal() to valueEquals()

const CONF_SCHEMA = {
    type: 'object',
    properties: {
        appUrl: {
            type: ['string', 'object'],
            // pattern: /^(http:\/\/|file:\/\/\/?)[^ ]+$/,
        },
        testPort: {
            type: 'number',
            optional: true,
        },
        testFiles: {
            type: ['string', 'array'],
        },
        browsers: {
            type: ['function', 'array'],
        },
        logLevel: {
            type: 'number',
            optional: true,
        },
        bailout: {
            type: 'boolean',
            optional: true,
        },
        // TODO "autoclose": close browser and test server when tests complete - default: true
        //      if false, wait for browser to close



    },
};

const DEFAULT_TEST_PORT = 47225;
const DEFAULT_TEST_NAME = '(Unnamed test)';

const ELLIPSIS_LIMIT = 60;

// TODO customizable dir for different screen resolution tests
const REF_SCREENSHOT_BASE_DIR = 'referenceScreenshots';
const ERRORS_SCREENSHOT_BASE_DIR = 'referenceErrors';

const ERRORS = {
    TIMEOUT: 0,
    NOT_EQUAL: 1,
};

const PPM = 1 / 1000000;

const PIXEL_THRESHOLD = 3 / 100;
const IMG_THRESHOLD = 20 * PPM;

exports = module.exports = Testrunner;

function Testrunner(conf) {
    EventEmitter.call(this);

    const defaultConf = {
        testPort: DEFAULT_TEST_PORT,
        waitForConnectionTimeout: 5000,
        logLevel: Loggr.LEVELS.ALL,
        bailout: false,
        keepalive: false,
        referenceScreenshotDir: REF_SCREENSHOT_BASE_DIR,
        beforeTest: null,
        afterTest: null,
        globalBeforeTest:null,
        globalAfterTest:null,
        outStream: process.stdout,
        context: {},
    };

    this._conf = Object.assign(defaultConf, conf);

    this._log = new Loggr({
        logLevel: this._conf.logLevel,
        showTime: true,
        namespace: 'Testrunner',
        indent: '  ',
        outStream: this._conf.outStream,
    });


    // check for configs not in defaultConf
    const confKeys = Object.keys(conf);
    const unknownKeys = confKeys.filter(key=>!(key in defaultConf))

    if (unknownKeys.length>0){
        this._log.warn(`unknown config keys: ${unknownKeys.join(', ')}`)
    }


    this._currentBeforeCommand = null;
    this._currentAfterCommand = null;

    this._tapWriter = new TapWriter({
        outStream: this._conf.outStream,
    });

    this._isBailingOut = false;

    // -------------------

    // TODO ensure browser names are unique (for reference images)

    const validationResult = Schema.validate(CONF_SCHEMA, this._conf);

    if (!validationResult.valid) {
        this._log.debug('conf validation failed');
        throw new Error(validationResult.format());
    }

    // -------------------

    if (!__isArray(this._conf.testFiles)) {
        this._conf.testFiles = [this._conf.testFiles];
    }


    if (!__isArray(this._conf.browsers)) {
        this._conf.browsers = [this._conf.browsers];
    }

    this._httpServer = null;

    // '_execFn,equal,click,setValue,waitForVisible,waitWhileVisible'.split(',').forEach(fnn=>{
    //     this[fnn]=this[fnn].bind(this)
    // })

    this.directAPI = {
        getValue: this._getValueDirect.bind(this),
        setValue: this._setValueDirect.bind(this),
        click: this._clickDirect.bind(this),
        waitForVisible: this._waitForVisibleDirect.bind(this),
        waitWhileVisible: this._waitWhileVisibleDirect.bind(this),
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
    });

    this._assertCount = 0;
    this._currentTestfilePath = null;
    this._currentBrowserName = null;

    this._log.trace('instance created');

    this._runStartTime = null;
}


util.inherits(Testrunner, EventEmitter);

Testrunner.prototype.setConfig = function (conf) {

};

Testrunner.prototype.run = async function () {
    process.exitCode = 0;

    this._runStartTime = Date.now();

    this._log.debug('running...');
    this._log.trace('input test files: ', this._conf.testFiles.join(', '));

    let testFilePaths = [];

    return multiGlobAsync(this._conf.testFiles)
    .then((paths) => {
        if (paths.length === 0) {
            throw new Error('No testfiles found');
        }

        testFilePaths = paths;
    })

    .then(() => rimrafAsync(ERRORS_SCREENSHOT_BASE_DIR))

    .then(() => this._startServers())

    .then(async () => {
        this._tapWriter.version();

        try {
            for (const browser of this._conf.browsers) {
                try {
                    this._currentBrowserName = browser.name;

                    this._tapWriter.comment(`Starting browser ${browser.name}`);

                    await browser.start();

                    for (const [pathIdx, testFilePath] of testFilePaths.entries()) {
                        this._assertCount = 0;

                        const isLastTestfile = pathIdx === testFilePaths.length - 1;

                        await this._runTestFile(testFilePath, {
                            browser,
                            isLastTestfile,
                        });
                    }
                }
                catch (err) {
                    process.exitCode = 1;

                    this._log.fatal(err.stack || err.toString());

                    if (err.type === 'BailoutError') {
                        this._isBailingOut = true;
                        this._tapWriter.bailout(err.message);
                        throw err;

                    }
                }
                finally {
                    if (this._browserPuppeteer.isPuppetConnected()) {
                        // await this._browserPuppeteer.terminatePuppet();
                        browser.open('');
                    }

                    await browser.stop();
                }
            }
        }
        catch (err) {
            // TODO better error handling
            console.error(err);
            console.error(err.stack);
        }
        finally {
            if (!this._isBailingOut) {
                this._tapWriter.plan();
                this._tapWriter.diagnostic(`tests ${this._tapWriter.testCount}`);
                this._tapWriter.diagnostic(`pass ${this._tapWriter.passCount}`);
                this._tapWriter.diagnostic(`fail ${this._tapWriter.failCount}`);
            }

            await this._stopServers();

            this._log.info('Finished in ' + formatDuration(Math.floor((Date.now() - this._runStartTime) / 1000)));
        }
    })
    .catch(error => {
        this._log.info(`ERROR: ${error.toString()}`);
    });
};

Testrunner.prototype._getCurrentAppUrl = function (testAppUrl) {
    const confAppUrl = this._conf.appUrl;

    if (typeof testAppUrl === 'string') {
        return testAppUrl;
    }

    if (typeof confAppUrl === 'string') {
        return confAppUrl;
    }

    if (typeof confAppUrl === 'object' && typeof testAppUrl === 'object') {
        const mergedUrl = Object.assign({}, confAppUrl, testAppUrl);
        return urllib.format(mergedUrl);
    }

    if (typeof confAppUrl === 'object' && testAppUrl === undefined) {
        return urllib.format(confAppUrl);
    }

    throw new Error('Config error: cannot resolve appUrl, mismatched conf and test appUrl types');
};

Testrunner.prototype._startServers = Promise.method(function () {
    const self = this;

    self._log.trace('_startServers called');

    self._browserPuppeteer.start();

    // return new Promise((res,rej)=>{
    //     self._httpServer = http.createServer(self._onHttpRequest.bind(self))

    //     self._httpServer.listen(self._conf.testPort, res)

    // })
});

Testrunner.prototype._stopServers = function () {
    // this._httpServer.close()
    this._browserPuppeteer.stop();
};

Testrunner.prototype._runTestFile = async function (testFilePath, data) {
    this._log.trace('_runTestFile');

    const isLastTestfile = data.isLastTestfile;
    const browser = data.browser;

    this._currentTestfilePath = testFilePath;
    const absPath = pathlib.resolve(testFilePath);
    this._log.debug(`Requiring testFile "${testFilePath}"`);

    const testFileFn = require(absPath);

    const testDatas = [];

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

        testDatas.push({ name: name, testFn: testFn });
    }

    testFileFn(testRegistrar);

    this._currentBeforeCommand = testRegistrar.beforeCommand || this._conf.beforeCommand || noop;
    this._currentAfterCommand = testRegistrar.afterCommand || this._conf.afterCommand || noop;

    const currentBeforeTest = testRegistrar.beforeTest || this._conf.beforeTest;
    const currentAfterTest = testRegistrar.afterTest || this._conf.afterTest;

    const currentAppUrl = this._getCurrentAppUrl(testRegistrar.appUrl);

    // TODO most config params should be overridable in testfiles


    for (const [testIndex, testData] of testDatas.entries()) {
        this._log.debug(`Running test: ${testData.name}`);

        this._tapWriter.diagnostic(testData.name);

        if (this._conf.globalBeforeTest) {
            this._log.debug('Running globalBeforeTest');
            await this._conf.globalBeforeTest(this.directAPI);
            this._log.debug('Completed globalBeforeTest');
        }

        if (currentBeforeTest) {
            this._log.debug('Running beforeTest');
            await currentBeforeTest(this.directAPI, this._conf.context);
            this._log.debug('Completed beforeTest');
        }

        browser.open(currentAppUrl);

        await this._waitUntilBrowserReady();

        const maybeTestPromise = testData.testFn(this.tAPI);

        if (typeof maybeTestPromise !== 'object' || typeof maybeTestPromise.then !== 'function') {
            throw new Error(`test function didn't return a promise (name: ${testData.name})`);
        }

        let maybeTestError = null

        try {
            await maybeTestPromise;
        }
        catch (err) {
            maybeTestError = err;

        }

        // if (testIndex < testDatas.length - 1) {
            await this._browserPuppeteer.clearPersistentData();
            browser.open('');
        // }

        if (currentAfterTest) {
            this._log.debug('Running afterTest');
            await currentAfterTest(this.directAPI, this._conf.context);
            this._log.debug('Completed afterTest');
        }

        if (this._conf.globalAfterTest) {
            this._log.debug('Running globalAfterTest');
            await this._conf.globalAfterTest(this.directAPI);
            this._log.debug('Completed globalAfterTest');
        }

        if (maybeTestError) {
            throw maybeTestError;
        }
    }
};

Testrunner.prototype._getCurrentBrowserReferenceScreenshotDir = function () {
    return pathlib.resolve(REF_SCREENSHOT_BASE_DIR, this._currentBrowserName);
};

Testrunner.prototype._getCurrentTestModuleReferenceScreenshotDir = function () {
    const testfilePathSlug = slugifyPath(this._currentTestfilePath);

    return pathlib.resolve(this._getCurrentBrowserReferenceScreenshotDir(), testfilePathSlug);
};

Testrunner.prototype._getCurrentBrowserReferenceErrorDir = function () {
    return pathlib.resolve(ERRORS_SCREENSHOT_BASE_DIR, this._currentBrowserName);
};

Testrunner.prototype._getCurrentTestModuleReferenceErrorDir = function () {
    const testfilePathSlug = slugifyPath(this._currentTestfilePath);

    return pathlib.resolve(this._getCurrentBrowserReferenceErrorDir(), testfilePathSlug);
};

Testrunner.prototype._waitUntilBrowserReady = async function () {
    await this._browserPuppeteer.waitForPuppet();
    await this._browserPuppeteer.showScreenshotMarker();
    return this._ensureBrowserIsVisible();
};

Testrunner.prototype._ensureBrowserIsVisible = async function () {
    this._log.info('Ensuring browser is visible...');

    while (true) {
        const screenshot = await screenshotjs();
        const markerPositions = bufferImageSearch(screenshot, cropMarkerImg);
        if (markerPositions.length === 0) {
            this._log.debug('Browser not yet visible');
        }
        else if (markerPositions.length === 2) {
            this._log.info('Browser is visible');
            break;
        }
        else {
            this._log.debug(`Screenshot marker count invalid (count: ${markerPositions.length})`);
        }
        await Promise.delay(3000);
    }
};

Testrunner.prototype._wrapFunctionWithSideEffects = function (fn, cmdType) {
    return (...args) => {
        return Promise.try(() => this._currentBeforeCommand(this.directAPI, { type: cmdType }))
        .then(() => fn(...args))
        .then(async fnResult => {
            await this._currentAfterCommand(this.directAPI, { type: cmdType });
            return fnResult;
        });
    };
};

Testrunner.prototype._execCommandWithAPI = Promise.method(function (cmd, api) {
    switch (cmd.type) {
        case 'setValue': return api.setValue(cmd.selector, cmd.value);
        case 'click': return api.click(cmd.selector);
        case 'waitForVisible': return api.waitForVisible(cmd.selector);
        case 'waitWhileVisible': return api.waitWhileVisible(cmd.selector);
        case 'focus': return api.focus(cmd.selector);
        case 'assert': return api.assert();
        // case 'scroll': return api.()
        // TODO missing commands
        default: throw new Error(`Unknown cmd.type ${cmd.type}`);
    }
});

Testrunner.prototype._execCommandDirect = Promise.method(function (cmd) {
    return this._execCommandWithAPI(cmd, this.directAPI);
});

Testrunner.prototype._execCommandSideEffect = Promise.method(function (cmd) {
    return this._execCommandWithAPI(cmd, this.sideEffectAPI);
});

Testrunner.prototype._execCommandsDirect = Promise.method(function (cmds) {
    return Promise.each(cmds, cmd => this._execCommandDirect(cmd));
});

Testrunner.prototype._execCommandsSideEffect = Promise.method(function (cmds) {
    return Promise.each(cmds, cmd => this._execCommandSideEffect(cmd));
});

Testrunner.prototype._equal = Promise.method(function (actual, expected, description) {
    if (isEqual(actual, expected)) {
        this._tapWriter.ok({
            type: 'equal',
            message: description,
        });
    }
    else {
        this._tapWriter.fail({
            type: 'equal',
            expected: expected,
            actual: actual,
        });

    }
});

Testrunner.prototype._clickDirect = async function (selector, rawDescription) {
    const description = rawDescription || `click - '${selector}'`;

    try {
        await this._browserPuppeteer.execCommand({
            type: 'click',
            selector: selector,
        });

        this._tapWriter.pass({ type: 'click', message: description });
    }
    catch (err) {
        this._tapWriter.notOk(err.message);

        if (this._conf.bailout) {
            throw createError('BailoutError', err.message);
        }
    }
};

Testrunner.prototype._getValue = Promise.method(function (selector) {
    return this._browserPuppeteer.execCommand({
        type: 'getValue',
        selector: selector,
    });
});

Testrunner.prototype._getValueDirect = Promise.method(function (selector) {
    // TODO logging?
    return this._browserPuppeteer.execCommand({
        type: 'getValue',
        selector: selector,
    });
});

Testrunner.prototype._setValueDirect = Promise.method(function (selector, value, rawDescription) {
    // TODO logging?
    const description = rawDescription || `setValue - ${selector}, ${value}`;

    return this._browserPuppeteer.execCommand({
        type: 'setValue',
        selector: selector,
        value: value,
    })
    .then(() => {
        this._tapWriter.pass({ type: 'setValue', message: description });
    })
    .catch(e => {
        this._tapWriter.notOk(e.message);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._pressKeyDirect = Promise.method(function (selector, keyCode, description) {
    this._log.info(`pressKey: ${keyCode} (${ellipsis(selector, ELLIPSIS_LIMIT)})`);

    return this._browserPuppeteer.execCommand({
        type: 'pressKey',
        selector: selector,
        keyCode: keyCode,
    });
});

Testrunner.prototype._waitForVisibleDirect = Promise.method(function (selector, timeout) {
    this._log.info(`waitForVisible: ${ellipsis(selector, ELLIPSIS_LIMIT)}`);

    return this._browserPuppeteer.execCommand({
        type: 'waitForVisible',
        selector: selector,
    })
    .catch(e => {
        this._tapWriter.notOk(`waitForVisible - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._waitWhileVisibleDirect = Promise.method(function (selector) {
    this._log.info(`waitWhileVisible: ${ellipsis(selector, ELLIPSIS_LIMIT)}`);

    return this._browserPuppeteer.execCommand({
        type: 'waitWhileVisible',
        selector: selector,
    })
    .catch(e => {
        this._tapWriter.notOk(`waitWhileVisible - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._focusDirect = Promise.method(function (selector, rawDescription) {
    this._log.info(`focus: ${selector}`);
    const description = rawDescription || `focus - selector: ${selector}`;

    return this._browserPuppeteer.execCommand({
        type: 'focus',
        selector: selector,
    })
    .then(() => {
        // this._tapWriter.pass({type:'focus',message:description})
    })
    .catch(e => {
        // this._tapWriter.notOk('focus - '+ e.message)
        this._tapWriter.diagnostic(`WARNING - focus - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._scrollDirect = Promise.method(function (selector, scrollTop) {
    this._log.info(`scroll: ${selector}`);

    return this._browserPuppeteer.execCommand({
        type: 'scroll',
        selector: selector,
        scrollTop: scrollTop,
    })
    .catch(e => {
        this._tapWriter.notOk(`scroll - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._compositeDirect = Promise.method(function (commands) {
    this._log.info(`composite: ${commands.map(cmd => cmd.type).join(', ')}`);

    return this._browserPuppeteer.execCommand({
        type: 'composite',
        commands: commands,
    })
    .catch(e => {
        this._tapWriter.notOk(`composite - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._mouseoverDirect = Promise.method(function (selector) {
    this._log.info(`mouseover: ${selector}`);

    return this._browserPuppeteer.execCommand({
        type: 'mouseover',
        selector: selector,
    })
    .catch(e => {
        this._tapWriter.notOk(`mouseover - ${e.message}`);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

Testrunner.prototype._execFunctionDirect = Promise.method(function (fn, ...args) {
    this._log.info('execFunction');

    return this._browserPuppeteer.execFunction(fn, args);
});

Testrunner.prototype._delay = Promise.method(function (ms, description) {
    this._log.info(`delay ${ms}`);
    return Promise.delay(ms);
});

Testrunner.prototype._comment = Promise.method(function (comment) {
    this._tapWriter.comment(comment);
});



// TODO remove sync codes
Testrunner.prototype._assert = async function () {
    const ssCount = this._assertCount;
    const refImgDir = this._getCurrentTestModuleReferenceScreenshotDir();
    const failedImgDir = this._getCurrentTestModuleReferenceErrorDir();
    const refImgName = `${ssCount}.png`;
    const refImgPath = pathlib.resolve(refImgDir, refImgName);
    const refImgPathRelative = pathlib.relative(pathlib.resolve(REF_SCREENSHOT_BASE_DIR), refImgPath);

    await mkdirpAsync(refImgDir);
    await mkdirpAsync(failedImgDir);

    return screenshotjs({ cropMarker: cropMarkerImg })
    .then(img => {
        try {
            fs.statSync(refImgPath);
            const refImg = PNG.sync.read(fs.readFileSync(refImgPath));
            const imgDiffResult = bufferImageDiff(img, refImg, { pixelThreshold: PIXEL_THRESHOLD, imageThreshold: IMG_THRESHOLD });

            if (imgDiffResult.same) {
                // TODO customizable message
                this._tapWriter.ok(`screenshot assert (${toPercent(imgDiffResult.difference)}): ${refImgPathRelative}`);
            }
            else {
                // TODO save image for later comparison
                // TODO customizable message
                this._tapWriter.notOk(`screenshot assert (${toPercent(imgDiffResult.difference)}): ${refImgPathRelative}`);

                const failedImgName = `${ssCount}.png`;
                const failedImgPath = pathlib.resolve(failedImgDir, failedImgName);
                const failedImgPathRelative = pathlib.relative(pathlib.resolve(ERRORS_SCREENSHOT_BASE_DIR), failedImgPath);

                const failedPng = new PNG(img);
                failedPng.data = img.data;
                const failedImgBin = PNG.sync.write(failedPng);

                fs.writeFileSync(failedImgPath, failedImgBin);

                this._log.info(`failed screenshot added: ${failedImgPathRelative}`);
            }
        }
        catch (e) {
            if (e.code === 'ENOENT') {
                const png = new PNG(img);
                png.data = img.data;
                const pngFileBin = PNG.sync.write(png);

                fs.writeFileSync(refImgPath, pngFileBin);

                this._log.info(`new reference image added: ${refImgPathRelative}`);
            }
            else {
                throw e;
            }
        }
    })
    .catch(e => {
        // TODO customizable message
        this._tapWriter.notOk(`screenshot assert: ${refImgName}, ${e}`);
    })
    .finally(() => {
        this._assertCount++;
    });
};

Testrunner.prototype._uploadFileAndAssignDirect = async function (data) {
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
        },
        destinationVariable: destinationVariable,
    });
};

function noop() {}

function __toString(v) {
    return Object.prototype.toString.call(v);
}
function __isArray(v) {
    return __toString(v) === '[object Array]';
}

function createError(type, msg) {
    const e = new Error(msg); e.type = type; return e;
}

function slugifyPath(s) {
    return s.replace(/[/\\]+/g, '___').replace(/[^a-z0-9_-]/ig, '_');
}

function ellipsis(s, l) {
    if (s.length <= l) {
        return s;
    } return `${s.substr(0, l - 3)}...`;
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

function toPercent(v, decimals = 4) {
    return (v * 100).toFixed(decimals);
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
