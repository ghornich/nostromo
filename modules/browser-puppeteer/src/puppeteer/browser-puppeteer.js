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

const DEFAULT_WAIT_FOR_CONNECTION_TIMEOUT_MS = 60000;

class PuppetNotConnectedError extends Error {}
class WaitForConnectionTimeoutError extends Error {}

// TODO define timeouts in ctor

/**
 * @typedef {object} BrowserPuppeteerConfig
 * @property {Number} [port = 47225] port to communicate with browser/BrowserPuppet
 * @property {Loggr} [logger] custom Loggr instance
 * 
 */

// TODO convert to ES6 class

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
    this._puppetId = null;

    this._currentMessageHandler = {
        resolve: null,
        reject: null,
        message: null,
    };

    this._log = this._conf.logger || new Loggr({
        logLevel: Loggr.LEVELS.INFO,
        namespace: 'BrowserPuppeteer',
    });

    this._puppetIdBlacklist = new Set();
}

util.inherits(BrowserPuppeteer, EventEmitter);

BrowserPuppeteer.prototype.start = async function () {
    this._log.trace('starting');

    this._httpServer = http.createServer(this._onHttpRequest.bind(this));
    this._wsServer = new WS.Server({ server: this._httpServer });

    this._wsServer.on('connection', this._onWsConnection.bind(this));
    this._wsServer.shouldHandle = this._wsShouldHandleRequest.bind(this);

    await new Promise(resolve => {
        this._httpServer.listen(this._conf.port, resolve);
    });
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

BrowserPuppeteer.prototype.isPuppetConnected = function () {
    return this._wsConn !== null;
};

BrowserPuppeteer.prototype.waitForConnection = async function (timeout = DEFAULT_WAIT_FOR_CONNECTION_TIMEOUT_MS) {
    const startTime = Date.now();

    while (true) {
        if (Date.now() > startTime + timeout) {
            throw new WaitForConnectionTimeoutError('BrowserPuppeteer.waitForConnection(): timeout');
        }

        if (this.isPuppetConnected()) {
            return;
        }

        await Promise.delay(500);
    }
};

BrowserPuppeteer.prototype.clearPersistentData = async function () {
    this._log.debug('clearPersistentData');

    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.CLEAR_PERSISTENT_DATA,
    });
};

BrowserPuppeteer.prototype._wsShouldHandleRequest = function (request) {
    try {
        const puppetId = getPuppetIdFromRequest(request);

        if (this._puppetIdBlacklist.has(puppetId)) {
            throw new Error(`puppetId is on blacklist`);
        }

        if (this._wsConn !== null) {
            throw new Error(`already connected`);
        }
    }
    catch (error) {
        this._log.error('_wsShouldHandleRequest: refused connection: ' + error.message);
        return false;
    }

    return true;
};

BrowserPuppeteer.prototype._onWsConnection = function (wsConn, request) {
    this._log.trace('_onWsConnection');

    this._puppetId = getPuppetIdFromRequest(request);
    this._wsConn = wsConn;
    this._wsConn.on('message', this._onWsMessage.bind(this));
    this._wsConn.on('error', this._onWsError.bind(this));
    this._wsConn.on('close', this._onWsClose.bind(this));

    this._log.debug(`puppet connected, id: ${this._puppetId}`);

    this.emit('puppetConnected');
};

BrowserPuppeteer.prototype._onWsMessage = function (rawData) {
    const data = JSONF.parse(rawData);

    const MAX_TRACE_RAW_LENGTH = 300;
    const trimmedRawData = rawData.length > MAX_TRACE_RAW_LENGTH
        ? rawData.substr(0, MAX_TRACE_RAW_LENGTH) + ' [...]'
        : rawData;

    this._log.trace(`_onWsMessage: ${trimmedRawData}`);

    if (data.type === MESSAGES.UPSTREAM.ACK) {
        this._currentMessageHandler.resolve(data.result);
        this._clearCurrentMessage();
    }
    else if (data.type === MESSAGES.UPSTREAM.NAK) {
        this._currentMessageHandler.reject(data.error);
        this._clearCurrentMessage();
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
    this._log.debug(`_onWsError code: ${code}`);

    this.closeConnection();
};

BrowserPuppeteer.prototype._onWsClose = function (code) {
    this._log.debug(`_onWsClose code: ${code}`);

    this.closeConnection();
};

BrowserPuppeteer.prototype.closeConnection = function () {
    this._log.debug(`closeConnection, puppet id: ${this._puppetId}`);

    // TODO what is the correct solution for this? silent resolve or reject?
    if (this._currentMessageHandler.resolve) {
        this._currentMessageHandler.resolve();
        this._clearCurrentMessage();
    }

    if (this._wsConn !== null) {
        this._wsConn.removeAllListeners('message');
        this._wsConn.removeAllListeners('error');
        this._wsConn.removeAllListeners('close');
        this._wsConn.terminate();
        this._wsConn = null;
    }
};

BrowserPuppeteer.prototype.terminateConnection = function () {
    if (this._wsConn !== null) {
        this._puppetIdBlacklist.add(this._puppetId);
        this.closeConnection();
    }
};

BrowserPuppeteer.prototype.sendMessage = async function (data) {
    if (this._currentMessageHandler.resolve) {
        const dataString = util.inspect(data);
        const currentMessageString = util.inspect(this._currentMessageHandler.message);

        throw new Error(`Cannot send multiple messages - ${dataString}, current message: ${currentMessageString}`);
    }

    if (!this.isPuppetConnected()) {
        await this.waitForConnection();
    }

    this._log.trace(`sending message, type: ${data ? data.type : 'undefined'}`);
    this._log.trace(util.inspect(data).slice(0, 1000));

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

BrowserPuppeteer.prototype.stop = async function () {
    this._log.debug('stopping...');

    this.closeConnection();

    await new Promise(resolve => this._wsServer.close(resolve));
    await new Promise(resolve => this._httpServer.close(resolve));

    this._log.debug('stopped');
};

BrowserPuppeteer.prototype._clearCurrentMessage = function () {
    this._currentMessageHandler.resolve = null;
    this._currentMessageHandler.reject = null;
    this._currentMessageHandler.message = null;
};

function getPuppetIdFromRequest(request) {
    const matches = request.url.match(/puppet-id=(\d+)/);

    if (!matches) {
        throw new Error('getPuppetIdFromRequest: missing puppetId');
    }

    return Number(matches[1]);
}

exports = module.exports = BrowserPuppeteer;
BrowserPuppeteer.PuppetNotConnectedError = PuppetNotConnectedError;
BrowserPuppeteer.WaitForConnectionTimeoutError = WaitForConnectionTimeoutError;
