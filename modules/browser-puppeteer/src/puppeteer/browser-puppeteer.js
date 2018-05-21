const MODULES_PATH = '../../../';
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const urllib = require('url');
const http = require('http');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const JSONF = require(MODULES_PATH + 'jsonf');
const WS = require('ws');
const Loggr = require(MODULES_PATH + 'loggr');
const MESSAGES = require('../messages');
const screenshotMarkerImg = require('../screenshot-marker');
const screenshotjs = require(MODULES_PATH + 'screenshot-js');
const bufferImageSearch = require(MODULES_PATH + 'buffer-image-search');

exports = module.exports = BrowserPuppeteer;

/**
 * @memberOf BrowserPuppeteer
 * @type {Number}
 */
const DEFAULT_WAITFORPUPPET_POLL_INTERVAL = BrowserPuppeteer.DEFAULT_WAITFORPUPPET_POLL_INTERVAL = 1000;

/**
 * @memberOf BrowserPuppeteer
 * @type {Number}
 */
const DEFAULT_WAITFORPUPPET_TIMEOUT = BrowserPuppeteer.DEFAULT_WAITFORPUPPET_TIMEOUT = 10000;

class EnsureVisibleTimeoutError extends Error {}

/**
 * @typedef {object} BrowserPuppeteerConfig
 * @property {Number} [port = 47225] port to communicate with browser/BrowserPuppet
 * @property {Loggr} [logger] custom Loggr instance
 * @property {Boolean} [deferredMessaging = false] - await for browser connection in sendMessage instead of throwing an error
 * @property {Number} [deferredMessagingTimeout = 10000]
 * 
 */

/**
 * @class
 * @param {BrowserPuppeteerConfig} [config]
 */
function BrowserPuppeteer(config) {
    EventEmitter.call(this);

    this._conf = config || {};

    this._conf.port = this._conf.port || 47225;

    this._httpServer = null;
    this._wsServer = null;
    this._wsConn = null;

    this._currentMessageHandler = {
        resolve: null,
        reject: null,
        message: null,
    };

    this._log = this._conf.logger || new Loggr({
        logLevel: Loggr.LEVELS.INFO,
        namespace: 'BrowserPuppeteer',
    });
}

util.inherits(BrowserPuppeteer, EventEmitter);

BrowserPuppeteer.EnsureVisibleTimeoutError = EnsureVisibleTimeoutError;

BrowserPuppeteer.prototype.start = function () {
    this._log.trace('starting');

    this._startServers();
};

BrowserPuppeteer.prototype._startServers = function () {
    this._httpServer = http.createServer(this._onHttpRequest.bind(this));
    this._wsServer = new WS.Server({ server: this._httpServer, perMessageDeflate: false });

    this._wsServer.on('connection', this._onWsConnection.bind(this));

    this._httpServer.listen(this._conf.port);
};

BrowserPuppeteer.prototype._onHttpRequest = async function (req, resp) {
    const parsedUrl = urllib.parse(req.url);

    if (parsedUrl.pathname === '/browser-puppet.defaults.js') {
        resp.setHeader('content-type', 'application/javascript');
        resp.end(await fs.readFileAsync(pathlib.resolve(__dirname, '../../dist/browser-puppet.defaults.js')));
    }
    else if (parsedUrl.pathname === '/browser-puppet.dist.js') {
        resp.setHeader('content-type', 'application/javascript');
        resp.end(await fs.readFileAsync(pathlib.resolve(__dirname, '../../dist/browser-puppet.dist.js')));
    }
    else {
        resp.statusCode = 404;
        resp.end('404');
    }
};

// TODO separate connectionTimeout, visibilityTimeout, screenshotInterval
// better naming (e.g. waitForPuppetVisible)

/**
 * @param {Object} [options]
 * @param {Object} [options.pollInterval={@link DEFAULT_WAITFORPUPPET_POLL_INTERVAL}]
 * @param {Object} [options.timeout={@link DEFAULT_WAITFORPUPPET_TIMEOUT}]
 * @param {Object} [ensureVisible = false] - ensure browser is visible with screenshot markers
 * @return {Promise}
 */
BrowserPuppeteer.prototype.waitForPuppet = async function (options) {
    this._log.info('waiting for puppet...');

    const _opts = options || {};
    _opts.pollInterval = _opts.pollInterval || DEFAULT_WAITFORPUPPET_POLL_INTERVAL;
    _opts.timeout = _opts.timeout || DEFAULT_WAITFORPUPPET_TIMEOUT;

    return new Promise((resolve, reject) => {
        let canCheck = true;

        if (_opts.timeout > 0) {
            setTimeout(function () {
                canCheck = false;
                reject(new Error('BrowserPuppeteer::waitForPuppet: timed out'));
            }, _opts.timeout);
        }

        const checker = () => {
            if (!canCheck) {
                return;
            }

            if (this._wsConn !== null && this._wsConn.readyState === WS.OPEN) {
                this._log.info('connected to puppet');
                resolve();
            }
            else {
                const state = this._wsConn
                    ? `readyState: ${this._wsConn.readyState}`
                    : 'no wsConn';

                this._log.trace(`waiting for puppet... ${state}`);

                setTimeout(checker, _opts.pollInterval);
            }
        };

        checker();
    })
    .then(async () => {
        if (_opts.ensureVisible) {
            this._log.info('Ensuring browser is visible...');

            const startTime = Date.now();

            while (true) {
                const screenshot = await screenshotjs();
                const markerPositions = bufferImageSearch(screenshot, screenshotMarkerImg);
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

                if (Date.now() - startTime > _opts.timeout) {
                    throw new Error('ensureVisible timeout')
                }

                await Promise.delay(3000);
            }
        }
    });
};

BrowserPuppeteer.prototype.isPuppetConnected = function () {
    return this._wsConn !== null;
};

BrowserPuppeteer.prototype.clearPersistentData = async function () {
    this._log.debug('clearPersistentData');

    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.CLEAR_PERSISTENT_DATA,
    });
};

BrowserPuppeteer.prototype._onWsConnection = function (wsConn) {
    this._log.trace('_onWsConnection');

    this._wsConn = wsConn;
    this._wsConn.on('message', this._onWsMessage.bind(this));
    this._wsConn.on('error', this._onWsError.bind(this));
    this._wsConn.on('close', this._onWsClose.bind(this));

    this.emit('puppetConnected');
};

BrowserPuppeteer.prototype._onWsMessage = function (rawData) {
    const data = JSONF.parse(rawData);
    const _cmh = this._currentMessageHandler;

    const MAX_TRACE_RAW_LENGTH=300;
    const trimmedRawData = rawData.length > MAX_TRACE_RAW_LENGTH
        ? rawData.substr(0, MAX_TRACE_RAW_LENGTH) + ' [...]'
        : rawData;

    this._log.trace(`_onWsMessage: ${trimmedRawData}`);

    if (data.type === MESSAGES.UPSTREAM.ACK) {
        _cmh.resolve(data.result);
        _cmh.resolve = _cmh.reject = _cmh.message = null;
    }
    else if (data.type === MESSAGES.UPSTREAM.NAK) {
        _cmh.reject(data.error);
        _cmh.resolve = _cmh.reject = _cmh.message = null;
    }
    else {
        const validTypes = Object.keys(MESSAGES.UPSTREAM).map(k => MESSAGES.UPSTREAM[k]);

        if (validTypes.indexOf(data.type) >= 0) {
            this._log.trace(`emitting message type "${data.type}"`);

            this.emit(data.type, data, rawData);
        }
        else {
            this._log.info(`unknown event type: "${data.type}"`);
        }
    }
};

BrowserPuppeteer.prototype._onWsError = function (code) {
    this._log.debug('_onWsError');
    this._log.trace(`_onWsError code: ${code}`);
};

BrowserPuppeteer.prototype._onWsClose = function (code) {
    this._log.debug('_onWsClose');
    this._log.trace(`_onWsClose code: ${code}`);
    this._wsConn = null;

    if (this._currentMessageHandler.resolve) {
        this._currentMessageHandler.resolve();

        this._clearCurrentMessageHandler();
    }
};

BrowserPuppeteer.prototype.discardClients = function () {
    this._wsConn = null;
    this._clearCurrentMessageHandler();

    if (this._wsServer) {
        this._wsServer.clients.forEach(function (client) {
            client.terminate();
        });
    }
};

BrowserPuppeteer.prototype.sendMessage = async function (data) {
    if (!this._wsConn) {
        if (this._conf.deferredMessaging) {
            await this.waitForPuppet({
                ensureVisible: true,
            });
        }
        else {
            throw new Error('Puppet not connected');
        }
    }

    if (this._currentMessageHandler.resolve) {
        const dataString = util.inspect(data);
        const currentMessageString = util.inspect(this._currentMessageHandler.message);

        throw new Error(`Cannot send multiple messages - ${dataString}, current message: ${currentMessageString}`);
    }

    this._log.debug('sending message');
    this._log.trace(util.inspect(data).slice(0, 300));

    return new Promise((res, rej) => {
        let sendableData = data;

        if (typeof sendableData === 'object') {
            sendableData = JSONF.stringify(sendableData);
        }
        this._wsConn.send(sendableData);

        this._currentMessageHandler.resolve = res;
        this._currentMessageHandler.reject = rej;
        this._currentMessageHandler.message = data;
    });
};

BrowserPuppeteer.prototype.execCommand = async function (command) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.EXEC_COMMAND,
        command: command,
    });
};

BrowserPuppeteer.prototype.execFunction = async function (fn, ...args) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.EXEC_FUNCTION,
        fn: fn,
        args: args,
    });
};

BrowserPuppeteer.prototype.setTransmitEvents = function (value) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_TRANSMIT_EVENTS,
        value: value,
    });
};

BrowserPuppeteer.prototype.setSelectorBecameVisibleSelectors = async function (selectors) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_SELECTOR_BECAME_VISIBLE_DATA,
        selectors: selectors,
    });
};

BrowserPuppeteer.prototype.setMouseoverSelectors = async function (selectors) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_MOUSEOVER_SELECTORS,
        selectors: selectors,
    });
};

BrowserPuppeteer.prototype.terminatePuppet = async function () {
    const result = await this.sendMessage({ type: MESSAGES.DOWNSTREAM.TERMINATE_PUPPET });

    this._wsConn = null;

    return result;
};

BrowserPuppeteer.prototype.stop = async function () {
    return new Promise(resolve => this._httpServer.close(resolve));
};

BrowserPuppeteer.prototype._clearCurrentMessageHandler = function () {
    this._currentMessageHandler.resolve = this._currentMessageHandler.reject = this._currentMessageHandler.message = null;
};
