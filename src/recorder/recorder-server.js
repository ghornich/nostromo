const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
const BrowserPuppeteer = require(MODULES_PATH + 'browser-puppeteer').BrowserPuppeteer;
const MESSAGES = require(MODULES_PATH + 'browser-puppeteer').MESSAGES;
const WS = require('ws');
const http = require('http');
const fs = Promise.promisifyAll(require('fs'));
const JSONF = require(MODULES_PATH + 'jsonf');
const pathlib = require('path');
const Loggr = require(MODULES_PATH + 'loggr');
const defaults = require('lodash.defaults');

/**
 * @memberOf RecorderServer
 * @type {Number}
 */
const DEFAULT_RECORDER_APP_PORT = 7700;

exports = module.exports = RecorderServer;

/**
 * @callback FilterCallback
 * @param {Object} data
 * @param {Object} data.event - DOM event data (type, target, selector, $timestamp, $fullSelectorPath)
 * @param {Command} data.command - Command generated from the event
 * @param {RecorderApp} data.recorderInstance - The current RecorderApp instance
 * @return {Boolean} Return false to prevent recording this event
 */

/**
 * @callback SelectorBecameVisibleCallback
 * @param {RecorderApp} recorderInstance - The current RecorderApp instance
 */

/**
 * @typedef {Object} OutputFormatter
 * @property {String} name - Display name
 * @property {String} [filename = RecorderApp.DEFAULT_OUTPUT_FILENAME]
 * @property {Function} fn - Formatter function, argument: Array<Commmand>, return: String
 */

/**
 * @typedef {Object} RecorderOptions
 * @property {Number} [recorderAppPort = {@link RecorderServer.DEFAULT_RECORDER_APP_PORT}]
 * @property {Number} [logLevel] - See Loggr.LEVELS
 *
 * @property {FilterCallback} [captureFilter]
 * @property {FilterCallback} [pressKeyFilter] - Special capture filter, only called for pressKey. <b>Default: capture Enter, Esc only</b>.
 *
 * @property {Array<Object>} [onSelectorBecameVisible]
 * @property {String} [onSelectorBecameVisible[].selector] - CSS selector
 * @property {SelectorBecameVisibleCallback} [onSelectorBecameVisible[].listener]
 *
 * @property {Array<OutputFormatter>} outputFormatters - Custom output and download formatter(s)
 * @property {String} [selectedOutputFormatter] - Selected output formatter name
 *
 * @property {Array<String>} [mouseoverSelectors] - Detect mouseover events only for these selectors
 * @property {Array<String>} [ignoredClasses] - Ignored classnames
 */

/**
 * @class
 * @param {RecorderOptions} conf
 */
function RecorderServer(conf) {
    this._conf = defaults({}, conf, {
        recorderAppPort: DEFAULT_RECORDER_APP_PORT,
        onSelectorBecameVisible: [],
        mouseoverSelectors: [],
        ignoredClasses: [],
    });

    // TODO assert conf

    this._recServer = http.createServer(this._onRecRequest.bind(this));
    this._wsServer = new WS.Server({ server: this._recServer });

    this._log = new Loggr({
        namespace: 'RecorderServer',
        logLevel: this._conf.logLevel,
    });

    this._puppeteer = new BrowserPuppeteer({
        logger: this._log.fork('BrowserPuppeteer'),
    });

    this._proxyMessage = this._proxyMessage.bind(this);
}

RecorderServer.DEFAULT_RECORDER_APP_PORT = DEFAULT_RECORDER_APP_PORT;

// TODO better promise chain?

RecorderServer.prototype.start = Promise.method(function () {
    this._wsServer.on('connection', () => this._log.info('recorder app connected'));

    this._recServer.listen(this._conf.recorderAppPort);
    this._puppeteer.start();

    console.log(`--- Open the recording app in your browser: http://localhost:${this._conf.recorderAppPort} ---`);

    this._puppeteer.on(MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, this._proxyMessage);
    this._puppeteer.on(MESSAGES.UPSTREAM.CAPTURED_EVENT, this._proxyMessage);
    this._puppeteer.on(MESSAGES.UPSTREAM.INSERT_ASSERTION, this._proxyMessage);

    this._puppeteer.on('puppetConnected', async () => {
        try {
            await this._puppeteer.setTransmitEvents(true);

            const selectors = (this._conf.onSelectorBecameVisible).map(data => data.selector);

            if (selectors.length > 0) {
                await this._puppeteer.setSelectorBecameVisibleSelectors(selectors);
            }

            if (this._conf.mouseoverSelectors.length > 0) {
                await this._puppeteer.sendMessage({
                    type: MESSAGES.DOWNSTREAM.SET_MOUSEOVER_SELECTORS,
                    selectors: this._conf.mouseoverSelectors,
                });
            }

            if (this._conf.ignoredClasses.length > 0) {
                await this._puppeteer.sendMessage({
                    type: MESSAGES.DOWNSTREAM.SET_IGNORED_CLASSES,
                    classes: this._conf.ignoredClasses,
                });
            }
        }
        catch (err) {
            this._log.error(err.stack || err.message);
        }
    });
});

RecorderServer.prototype._proxyMessage = function (data, rawData) {
    if (this._wsServer.clients.size === 1) {
        this._wsServer.clients.forEach(wsConn => wsConn.send(rawData));
    }
    else {
        this._log.debug(`_proxyMessage warning: invalid recording app connection count: ${this._wsServer.clients.size}`);
    }
};

RecorderServer.prototype._onRecRequest = async function (req, resp) {
    if (req.url === '/') {
        resp.end(
            (await fs.readFileAsync(pathlib.resolve(__dirname, 'ui/recorder-ui.html'), { encoding: 'utf-8' }))
            .replace('[[CONFIG]]', JSONF.stringify(this._conf).replace(/\\/g, '\\\\').replace(/'/g, '\\\''))
            .replace('[[STYLE]]', await fs.readFileAsync(pathlib.resolve(__dirname, 'ui/app/style.css')))
        );
    }
    else if (req.url === '/script.js') {
        resp.end(await fs.readFileAsync(pathlib.resolve(__dirname, '../../dist/recorder-app.dist.js'), { encoding: 'utf-8' }));
    }
    else {
        resp.status = 404;
        resp.end('Not found');
    }
};
