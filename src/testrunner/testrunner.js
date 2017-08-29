const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
Promise.config({ longStackTraces: true });
const Loggr = require(`${MODULES_PATH}loggr`);
const defaults = require('lodash.defaults');
const isEqual = require('lodash.isequal');
const Schema = require('schema-inspector');
const fs = require('fs');
const pathlib = require('path');
const util = require('util');
const TapWriter = require(`${MODULES_PATH}tap-writer`);
const EventEmitter = require('events').EventEmitter;
const BrowserPuppeteer = require(`${MODULES_PATH}browser-puppeteer`).BrowserPuppeteer;
const MESSAGES = require(`${MODULES_PATH}browser-puppeteer`).MESSAGES;
const cropMarkerImg = require(`${MODULES_PATH}browser-puppeteer`).SCREENSHOT_MARKER;
const screenshotjs = require(`${MODULES_PATH}screenshot-js`);
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const PNG = require('pngjs').PNG;
const globAsync = Promise.promisify(require('glob'));
const bufferImageSearch = require(`${MODULES_PATH}buffer-image-search`);
const bufferImageDiff = require(`${MODULES_PATH}buffer-image-diff`);
const rimrafAsync = Promise.promisify(require('rimraf'));

// TODO show error if test(...) doesn't return a promise

// TODO standard tape API (sync), rename current equal() to valueEquals()

const CONF_SCHEMA = {
    type: 'object',
    properties: {
        appUrl: {
            type: 'string',
            pattern: /^(http:\/\/|file:\/\/\/?)[^ ]+$/,
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

    this._conf = defaults({}, conf, {
        testPort: DEFAULT_TEST_PORT,
        waitForConnectionTimeout: 5000,
        logLevel: Loggr.LEVELS.INFO,
        bailout: false,
        keepalive: false,
        referenceScreenshotDir: REF_SCREENSHOT_BASE_DIR,
        beforeTest: noop,
        afterTest: noop,
    });

    this._log = new Loggr({
        level: this._conf.logLevel,
        showTime: true,
        namespace: 'Testrunner',
        outStream: {
            write: function (str) {
                process.stdout.write(`  ${str}`);
            },
        },
    });


    this._beforeCommand = null;
    this._afterCommand = null;

    this._tapWriter = new TapWriter();

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
        isVisible: this._isVisibleDirect.bind(this),
        delay: this._delay.bind(this),
        comment: this._comment.bind(this),
        assert: this._assert.bind(this),
        pressKey: this._pressKeyDirect.bind(this),
        composite: this._compositeDirect.bind(this),
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

    this._browserPuppeteer = new BrowserPuppeteer({
        logger: this._log.fork('BrowserPuppeteer'),
    });

    this._assertCount = 0;
    this._currentTestfilePath = null;
    this._currentBrowserName = null;

    this._log.trace('instance created');
}

util.inherits(Testrunner, EventEmitter);

Testrunner.prototype.run = Promise.method(function () {
    this._log.debug('running...');
    this._log.trace('input test files: ', this._conf.testFiles);

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

    .then(() => {
        this._tapWriter.version();

        return Promise.each(this._conf.browsers, async (browser) => {
            try {

                this._currentBrowserName = browser.name;

                // TODO beforeBrowser, afterBrowser


                // await mkdirpAsync(this._getCurrentBrowserReferenceScreenshotDir())
                // await mkdirpAsync(this._getCurrentBrowserReferenceErrorDir())

                await browser.start(this._conf.appUrl);

                for (const [pathIdx, testFilePath] of testFilePaths.entries()) {
                    // await this._browserPuppeteer.discardClients()
                    // this._assertCount=0

                    await this._browserPuppeteer.waitForPuppet();

                    await this._browserPuppeteer.sendMessage({
                        type: MESSAGES.DOWNSTREAM.SHOW_SCREENSHOT_MARKER,
                    });

                    this._log.info('Ensuring browser is visible...');

                    while (true) {
                        const screenshot = await screenshotjs();
                        const markerPositions = bufferImageSearch(screenshot, cropMarkerImg);
                        if (markerPositions.length === 2) {
                            this._log.info('Browser is visible');
                            break;
                        }
                        else {
                            this._log.debug(`Screenshot marker count invalid (count: ${markerPositions.length })`);
                        }
                        await Promise.delay(2000);
                    }

                    await this._runTestFile(testFilePath);

                    if (pathIdx < testFilePaths.length - 1) {
                        this._log.info('sending reopen signal');

                        this._browserPuppeteer._wsConn.send(JSON.stringify({
                            type: MESSAGES.DOWNSTREAM.REOPEN_URL,
                            url: this._conf.appUrl,
                        }));
                        this._browserPuppeteer.discardClients();
                        // await this._browserPuppeteer.reopen(this._conf.appUrl)
                    }
                }

            }
            catch (err) {
                // TODO better error handling
                console.error(err);
                console.error(err.stack);
            }
            finally {
                // TODO optionally keep browser open for debugging (wait for manual closing?)
                // if (!this._conf.keepalive) {
                await browser.stop();
                // }
            }
        })
        .catch(err => {
            // TODO better error handling
            console.error(err);
            console.error(err.stack);
        })
        .finally(async () => {
            this._tapWriter.plan();

            await this._stopServers();

            this._tapWriter.diagnostic(`tests ${this._tapWriter.testCount}`);
            this._tapWriter.diagnostic(`pass ${this._tapWriter.passCount}`);
            this._tapWriter.diagnostic(`fail ${this._tapWriter.failCount}`);
        });
    })
    .catch(error => {
        this._log.info(`ERROR: ${error.toString()}`);
    });
});

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

Testrunner.prototype._runTestFile = async function (testFilePath) {
    try {
        this._currentTestfilePath = testFilePath;
        const absPath = pathlib.resolve(testFilePath);
        this._log.debug(`Requiring testFile "${testFilePath}"`);
        const testModule = require(absPath);

        await this._runTestModule(testModule);
    }
    catch (err) {
        if (err.type === 'BailoutError') {
            console.log(err.stack);
            this._tapWriter.bailout(err.message);
        }
        else {
            console.log('_runTestFile err:', err);
        }
    }
};

/* Testrunner.prototype._runTestFiles = function(testFilePaths){
    var testCount = 0

    this._tapWriter.version()

    return mkdirpAsync(this._getCurrentBrowserReferenceScreenshotDir())
    .then(()=>mkdirpAsync(this._getCurrentBrowserReferenceErrorDir()))
    .then(() => {
        return Promise.each(testFilePaths, path => {
            this._currentTestfilePath=path
            var absPath = pathlib.resolve(path)
            this._log.debug(`Requiring testFile "${path}"`)
            var testModule = require(absPath)

            return this._runTestModule(testModule)
        })
    })
    .then(() => this._tapWriter.plan())
    .catch(err=>{
        if (err.type==='BailoutError') {
            console.log(err.stack)
            this._tapWriter.bailout(err.message)
        }
        else {
            console.log('_runTestFiles err:',err)
        }
    })
}*/

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

Testrunner.prototype._runTestModule = function (fn) {
    this._log.trace('_runTestModule');

    // return mkdirpAsync(this._getCurrentTestModuleReferenceScreenshotDir())
    // .then(()=>mkdirpAsync(this._getCurrentTestModuleReferenceErrorDir()))
    return Promise.resolve()
    .then(() => {
        const testDatas = [];

        // TODO optional name
        function testRegistrar(name, testFn) {
            testDatas.push({ name: name, testFn: testFn });
        }

        testRegistrar.Promise = Promise;

        fn(testRegistrar);

        // TODO show before/after commands in logging
        this._beforeCommand = testRegistrar.beforeCommand || this._conf.defaultBeforeCommand || noop;
        this._afterCommand = testRegistrar.afterCommand || this._conf.defaultAfterCommand || noop;

        return Promise.each(testDatas, testData => {
            this._tapWriter.diagnostic(testData.name);
            this._log.debug(`Running test: ${testData.name || '(anonymous)'}`);

            return Promise.try(this._conf.beforeTest)
            .then(() => {
                const maybePromise = testData.testFn(this.tAPI);

                if (typeof maybePromise.then !== 'function') {
                    throw new Error(`test function didn't return a promise (name: ${testData.name})`);
                }

                return maybePromise;
            })
            .then(this._conf.afterTest);

        });
    });
};

// TODO add next/prev command as param in before/after calls
Testrunner.prototype._wrapFunctionWithSideEffects = function (fn, cmdType) {
    return (...args) => {
        return Promise.try(() => this._beforeCommand(this.directAPI, { type: cmdType }))
        .then(() => fn(...args))
        .then(async fnResult => {
            await this._afterCommand(this.directAPI, { type: cmdType });
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
        case 'isVisible': return api.isVisible(cmd.selector);
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

// TODO use
Testrunner.prototype._selectorEqualDirect = Promise.method(function (selector, expected, rawDescription) {
    const description = rawDescription || `equal - ${selector }, ${expected}`;

    return this._getValue(selector)
    .then(actual => {
        if (expected === actual) {
            this._tapWriter.pass({ type: 'equal', message: description });
        }
        else {
            const err = new Error('not equal');
            err.type = ERRORS.NOT_EQUAL;
            err.expected = expected;
            err.actual = actual;
            err.description = description;
            throw err;
        }
    })
    .catch(err => {
        /* errors:
        selector not found
        selector not unique
        not equal
        timeout?
        */

        if (err.type === ERRORS.NOT_EQUAL) {
            this._tapWriter.fail({
                type: 'equal',
                expected: err.expected,
                actual: err.actual,
            });
        }
        else {
            this._tapWriter.notOk(err.message);
        }

        if (this._conf.bailout) {
            throw createError('BailoutError', err.message);
        }
    });
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

// TODO fix+use or remove
Testrunner.prototype._isEqualDirect = Promise.method(function (selector, expected, description) {
    return this._getValue(selector)
    .then(actual => expected === actual)
    .catch(err => this._tapWriter.notOk(err.message));
});

Testrunner.prototype._clickDirect = Promise.method(function (selector, rawDescription) {
    const description = rawDescription || `click - ${selector}`;

    return this._browserPuppeteer.execCommand({
        type: 'click',
        selector: selector,
    })
    .then(() => {
        this._tapWriter.pass({ type: 'click', message: description });
    })
    .catch(e => {
        this._tapWriter.notOk(e.message);

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message);
        }
    });
});

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
    const description = rawDescription || `setValue - ${selector }, ${value}`;

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
    this._log.info(`pressKey: ${keyCode } (${ellipsis(selector, ELLIPSIS_LIMIT) })`);

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

Testrunner.prototype._isVisibleDirect = Promise.method(function (selector, description) {
    throw new Error('TODO _isVisibleDirect');
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

                const failedImgName = `${ssCount }.png`;
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
        this._tapWriter.notOk(`screenshot assert: ${refImgName }, ${e}`);
    })
    .finally(() => {
        this._assertCount++;
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
