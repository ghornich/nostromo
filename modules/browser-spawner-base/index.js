'use strict';

const assert = require('assert');
const pathlib = require('path');
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const rimraf = require('rimraf');
const Loggr = require('../loggr');
const http = require('http');
const WS = require('ws');
const truncateString = require('lodash.truncate');
const treeKill = require('tree-kill');
const delay = require('../delay');
const screenshotMarkerImg = require('./screenshot-marker');
const screenshotjs = require('../screenshot-js');
const bufferImageSearch = require('../buffer-image-search');

const TEMP_DELETE_RETRIES = BrowserSpawnerBase.TEMP_DELETE_RETRIES = 10;
const TEMP_DELETE_TIMEOUT = BrowserSpawnerBase.TEMP_DELETE_TIMEOUT = 1000;

const DEFAULT_SPAWNER_PORT = 24556;

class TimeoutError extends Error {}

/**
 * @typedef {BrowserSpawnerConfig}
 *
 * @property {String} name - Display name for this browser
 * @property {String} path - Path to browser executable
 * @property {String} [tempDir] - Temporary profile dir path. Defaults to a random directory in cwd
 * @property {Number} width - Recorded app viewport width
 * @property {Number} height - Recorded app viewport height
 * @property {Object} [logger] - Custom Loggr instance
 * @property {Number} [waitForConnectionTimeoutMs = 60000]
 * @property {Number} [waitForConnectionPollIntervalMs = 500]
 * @property {Number} [visibilityTimeoutMs = 60000]
 * @property {Number} [visibilityPollIntervalMs = 3000]
 */

// TODO es6 class

/**
 * @param {BrowserSpawnerConfig} conf
 */
function BrowserSpawnerBase(conf) {
    EventEmitter.call(this);

    assert(conf, 'BrowserSpawnerBase: missing conf');

    this._conf = Object.assign({}, {
        tempDir: pathlib.resolve(conf.tempDir || this._getDefaultTempDir()),
        waitForConnectionTimeoutMs: 60000,
        waitForConnectionPollIntervalMs: 500,
        visibilityTimeoutMs: 60000,
        visibilityPollIntervalMs: 3000,
    }, conf);

    this._log = conf.logger || new Loggr({
        namespace: `BrowserSpawner ${this._conf.name}`,
        indent: '  ',
    });

    this._process = null;

    this._httpServer = http.createServer((request, response) => response.end('404'));
    this._wsServer = null;
    this._wsConn = null;

    Object.defineProperties(this, {
        name:  {
            get: function () {
                return this._conf.name;
            },
        },
        path: {
            get: function () {
                return this._conf.path;
            },
        },
    });
}

util.inherits(BrowserSpawnerBase, EventEmitter);

/**
 * 
 * @param {String} url - URL to open
 * @return {Promise}
 */
BrowserSpawnerBase.prototype.start = async function () {
    this._wsServer = new WS.Server({ server: this._httpServer, perMessageDeflate: false });

    this._wsServer.on('connection', this._onWsConnection.bind(this));

    this._wsServer.on('error', err => {
        this._log.error(err.stack || err.message);
    });

    await new Promise(res => this._httpServer.listen(DEFAULT_SPAWNER_PORT, res));

    await this._startBrowser(pathlib.resolve(__dirname, 'browser-spawner-context.html'));
    await this._waitForConnection();

    // TODO await this with events?
    this._sendWsMessage({
        type: 'set-iframe-size',
        width: this._conf.width,
        height: this._conf.height,
    });
    await delay(500);
};

BrowserSpawnerBase.prototype._isConnected = function () {
    return this._wsConn !== null;
}

BrowserSpawnerBase.prototype._waitForConnection = async function () {
    const startTime = Date.now();
    const timeoutMs = this._conf.waitForConnectionTimeoutMs;

    while (!this._isConnected()) {
        if (startTime + timeoutMs < Date.now()) {
            throw new TimeoutError(`BrowserSpawnerBase._waitForConnection: timeout after ${timeoutMs}ms`);
        }

        await delay(this._conf.waitForConnectionPollIntervalMs);
    }
};

BrowserSpawnerBase.prototype._onWsConnection = function (conn) {
    this._wsConn = conn;
};

BrowserSpawnerBase.prototype.isBrowserVisible = async function () {
    const screenshot = await screenshotjs();
    const markerPositions = bufferImageSearch(screenshot, screenshotMarkerImg);
    const isVisible = markerPositions.length === 2;

    if (markerPositions.length !== 0 && markerPositions.length !== 2) {
        this._log.warn(`isBrowserVisible: invalid marker position count: ${markerPositions.length}`);
    }

    this._log.debug(`isBrowserVisible: ${isVisible}`);

    return isVisible;
};

BrowserSpawnerBase.prototype.waitForBrowserVisible = async function () {
    const startTime = Date.now();
    const timeoutMs = this._conf.visibilityTimeoutMs;

    while (!this.isBrowserVisible()) {
        if (startTime + timeoutMs < Date.now()) {
            throw new TimeoutError(`BrowserSpawnerBase.waitForBrowserVisible: timeout after ${timeoutMs}ms`);
        }

        await delay(this._conf.visibilityPollIntervalMs);
    }
};

/**
 * @abstract
 * @param {String} spawnerControlUrl
 * @return {Promise}
 */
BrowserSpawnerBase.prototype._startBrowser = async function () {
    throw new Error('BrowserSpawnerBase._startBrowser: not implemented');
};

BrowserSpawnerBase.prototype.open = async function (url) {
    if (!this._wsConn) {
        throw new Error('BrowserSpawnerBase.open: not connected');
    }

    const truncatedUrl = truncateString(url, {
        length: 120,
        omission: ' [...]',
    });

    this._log.info(`opening address "${truncatedUrl}"`);

    if (truncatedUrl.length < url) {
        this._log.trace(`opening address "${url}"`);
    }

    this._sendWsMessage({ type: 'open', url: url });

    // hack await
    await delay(500);
};

BrowserSpawnerBase.prototype._sendWsMessage = function (msgArg) {
    let msg = msgArg;
    if (typeof msgArg === 'object') {
        msg = JSON.stringify(msgArg);
    }

    this._wsConn.send(msg);
};

BrowserSpawnerBase.prototype.stop = async function () {
    if (this._process && this._wsServer) {
        await new Promise(resolve => {
            this._wsServer.close(resolve);
        });

        try {
            await new Promise((resolve, reject) => {
                treeKill(this._process.pid, err => err ? reject(err) : resolve());
            });
        }
        catch (error) {
            this._log.error(`failed to stop browser: ${error.stack || error.message}`)
        }

        await new Promise(res => this._httpServer.close(res));
        this._wsConn = null;
        this._process = null;
    }
    else {
        throw new Error('Process or WS Server not running');
    }
};

/**
 * 
 * @param {String} eventName - 'close', 'error'
 * @param {Function} callback - Params: 'close' event: none; 'error' event: error
 */
// BrowserSpawnerBase.prototype.on = function () {
//     return Promise.reject(new Error('BrowserSpawnerBase.on: not implemented'))
// };

BrowserSpawnerBase.prototype._getDefaultTempDir = function () {
    throw new Error('BrowserSpawnerBase._getDefaultTempDir: not implemented');
};

BrowserSpawnerBase.prototype._deleteTempDir = function () {
    // TODO delete all previous temp dirs too

    return new Promise((resolve) => {
        this._log.debug('BrowserSpawnerBase: deleting temp dir');

        let attempts = 0;

        const loop = () => {
            attempts++;

            if (attempts > TEMP_DELETE_RETRIES) {
                throw new Error('BrowserSpawnerBase: maximum temp dir delete retries reached');
            }

            rimraf(this._conf.tempDir, (maybeError) => {
                if (maybeError) {
                    this._log.error(`BrowserSpawnerBase: deleting temp dir failed: ${maybeError}`);

                    setTimeout(loop, TEMP_DELETE_TIMEOUT);
                }
                else {
                    resolve();
                }
            });
        };

        loop();
    });
};

exports = module.exports = BrowserSpawnerBase;
BrowserSpawnerBase.TimeoutError = TimeoutError;
