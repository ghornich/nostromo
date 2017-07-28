var rfr=require('rfr')
const fs = require('fs');
const pathlib = require('path');
const urllib = require('url');
const http = require('http');
const util = require('util');
const EventEmitter = require('events').EventEmitter;
const JSONF = rfr('modules/jsonf');
const WS = require('ws');
const Promise = require('bluebird');
const Loggr = rfr('modules/loggr');
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

BrowserPuppeteer.prototype._onHttpRequest = function (req, resp) {
    const parsedUrl = urllib.parse(req.url);
    
    if (parsedUrl.pathname === '/browser-puppet.defaults.js') {
        resp.setHeader('content-type', 'application/javascript');
        resp.end(fs.readFileSync(pathlib.resolve(__dirname, '../../dist/browser-puppet.defaults.js')));
    }
    else if (parsedUrl.pathname === '/browser-puppet.dist.js') {
        resp.setHeader('content-type', 'application/javascript');
        resp.end(fs.readFileSync(pathlib.resolve(__dirname, '../../dist/browser-puppet.dist.js')));
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
        var checker = () => {
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
                setTimeout(checker, 500);
            }
        };

        checker();
    });
});

BrowserPuppeteer.prototype._onWsConnection = function (wsConn) {
    this._log.trace('_onWsConnection');

    this._wsConn = wsConn;
    this._wsConn.on('message', this._onMessage.bind(this));

    this.emit('puppetConnected');
};

BrowserPuppeteer.prototype._onMessage = function (rawData) {
    const data = JSONF.parse(rawData);
    const _cmh = this._currentMessageHandler;

    this._log.trace(`_onMessage: ${ rawData}`);

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

BrowserPuppeteer.prototype.discardClients = function () {
    this._wsConn = null;
    if (this._wsServer) {
        this._wsServer.clients.forEach(function (client) {
            client.terminate();
        });
    }
};

BrowserPuppeteer.prototype.sendMessage = Promise.method(function (data) {
    if (!this._wsConn) {
        throw new Error('Puppet not connected');
    }
    if (this._currentMessageHandler.resolve) {
        throw new Error('Cannot send multiple messages');
    }

    this._log.debug('sending message');
    this._log.trace(util.inspect(data));

    return new Promise((res, rej) => {
        if (typeof data === 'object') {
            data = JSONF.stringify(data);
        }
        this._wsConn.send(data);

        this._currentMessageHandler.resolve = res;
        this._currentMessageHandler.reject = rej;
    });
});

BrowserPuppeteer.prototype.execCommand = Promise.method(function (command) {
    return this.sendMessage({
        type: MESSAGES.DOWNSTREAM.EXEC_COMMAND,
        command: command,
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

// TODO promise, resolve when closed
BrowserPuppeteer.prototype.stop = function () {
    this._httpServer.close();
};
