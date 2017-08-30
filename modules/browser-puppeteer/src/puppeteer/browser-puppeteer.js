const MODULES_PATH = '../../../';
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const pathlib = require('path');
const urllib = require('url');
const http = require('http');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const JSONF = require(`${MODULES_PATH}jsonf`);
const WS = require('ws');
const Loggr = require(`${MODULES_PATH}loggr`);
const MESSAGES = require('../messages');

// TODO transparent settings for puppet? (same function interface here & there)

exports = module.exports = BrowserPuppeteer;

/**
 * @typedef {object} LoggerInstance
 * @property {Function} info
 * @property {Function} debug
 * @property {Function} trace
 */

/**
 * @typedef {object} BrowserPuppeteerConfig
 * @property {Number} [port = 47225] port to communicate with browser/BrowserPuppet
 * @property {LoggerInstance} [logger] custom logger instance
 */

/**
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
    };

    this._log = this._conf.logger || new Loggr({
        level: Loggr.LEVELS.INFO,
        namespace: 'BrowserPuppeteer',
    });
}

util.inherits(BrowserPuppeteer, EventEmitter);


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

// TODO timeout
BrowserPuppeteer.prototype.waitForPuppet = Promise.method(function () {
    this._log.info('waiting for puppet...');

    return new Promise((res, rej) => {
        const checker = () => {
            if (this._wsConn !== null && this._wsConn.readyState === WS.OPEN) {
                this._log.info('connected to puppet');
                res();
            }
            else {
                this._log.trace(`waiting for puppet...${
                    this._wsConn
                        ? `readyState: ${ this._wsConn.readyState}`
                        : 'no wsConn'}`
                );
                // TODO no magic numbers
                setTimeout(checker, 1000);
            }
        };

        checker();
    });
});

BrowserPuppeteer.prototype.reopenUrl = function (url) {
    this._log.debug(`reopenUrl: ${url}`);

    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.REOPEN_URL,
        url: url,
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

    this._log.trace(`_onWsMessage: ${rawData}`);

    if (data.type === MESSAGES.UPSTREAM.ACK) {
        _cmh.resolve(data.result);
        _cmh.resolve = _cmh.reject = null;
    }
    else if (data.type === MESSAGES.UPSTREAM.NAK) {
        _cmh.reject(data.error);
        _cmh.resolve = _cmh.reject = null;
    }
    else {
        const validTypes = Object.keys(MESSAGES.UPSTREAM).map(k => MESSAGES.UPSTREAM[k]);

        if (validTypes.indexOf(data.type) >= 0) {
            this._log.trace(`emitting message type ${ data.type}`);

            this.emit(data.type, data, rawData);
        }
        else {
            this._log.info(`unknown event type: ${data.type}`);
        }
    }
};

BrowserPuppeteer.prototype._onWsError = function (event) {
    this._log.debug('_onWsError');
    this._log.trace(event);
};

BrowserPuppeteer.prototype._onWsClose = function (event) {
    this._log.debug('_onWsClose');
    this._log.trace(event);
};

BrowserPuppeteer.prototype.discardClients = function () {
    this._wsConn = null;
    if (this._wsServer) {
        this._wsServer.clients.forEach(function (client) {
            client.terminate();
        });
    }
};

BrowserPuppeteer.prototype.sendMessage = async function (data) {
    if (!this._wsConn) {
        throw new Error('Puppet not connected');
    }
    if (this._currentMessageHandler.resolve) {
        throw new Error(`Cannot send multiple messages - ${util.inspect(data)}`);
    }

    this._log.debug('sending message');
    this._log.trace(util.inspect(data));

    return new Promise((res, rej) => {
        let sendableData = data;

        if (typeof sendableData === 'object') {
            sendableData = JSONF.stringify(sendableData);
        }
        this._wsConn.send(sendableData);

        this._currentMessageHandler.resolve = res;
        this._currentMessageHandler.reject = rej;
    });
};

BrowserPuppeteer.prototype.execCommand = Promise.method(function (command) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.EXEC_COMMAND,
        command: command,
    });
});

BrowserPuppeteer.prototype.execFunction = Promise.method(function (fn, ...args) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.EXEC_FUNCTION,
        fn: fn,
        args: args,
    });
});

BrowserPuppeteer.prototype.setTransmitEvents = function (value) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_TRANSMIT_EVENTS,
        value: value,
    });
};

BrowserPuppeteer.prototype.setSelectorBecameVisibleSelectors = Promise.method(function (selectors) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_SELECTOR_BECAME_VISIBLE_DATA,
        selectors: selectors,
    });
});

BrowserPuppeteer.prototype.setMouseoverSelectors = Promise.method(function (selectors) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.SET_MOUSEOVER_SELECTORS,
        selectors: selectors,
    });
});

BrowserPuppeteer.prototype.terminatePuppet = async function () {
    return this.sendMessage({ type: MESSAGES.DOWNSTREAM.TERMINATE_PUPPET });
};

BrowserPuppeteer.prototype.showScreenshotMarker = async function () {
    return this.sendMessage({ type: MESSAGES.DOWNSTREAM.SHOW_SCREENSHOT_MARKER });
};

// TODO promise, resolve when closed
BrowserPuppeteer.prototype.stop = function () {
    this._httpServer.close();
};
