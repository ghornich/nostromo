'use strict';

const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
const WS = require('ws');
const http = require('http');
const fs = Promise.promisifyAll(require('fs'));
const JSONF = require(MODULES_PATH + 'jsonf');
const pathlib = require('path');
const Loggr = require(MODULES_PATH + 'loggr');
const defaults = require('lodash.defaults');

const puppeteer = require('puppeteer');

exports = module.exports = RecorderServer;

/**
 * @callback FilterCallback
 * @param {Object} data
 * @param {Object} data.event - DOM event data (type, target, selector, $timestamp, $fullSelectorPath) - TODO typedef
 * @param {Command} data.command - Command generated from the event
 * @param {RecorderApp} data.recorderInstance - The current RecorderApp instance
 * @return {Boolean} Return false to prevent recording this event
 */

/**
 * @callback OnChangeCallback
 * @param {Object} data
 * @param {Object} data.event - TODO typedef
 * @param {RecorderApp} data.recorderInstance
 */

/**
 * @callback SelectorBecameVisibleCallback
 * @param {RecorderApp} recorderInstance - The current RecorderApp instance
 */

/**
 * @typedef {Object} OutputFormatter
 * @property {String} name - Display name
 * @property {String} [filename = RecorderApp.DEFAULT_OUTPUT_FILENAME]
 * @property {Function} fn - Formatter function, argument: Array&lt;Command&gt;, return: String
 */

/**
 * @typedef {Object} RecorderOptions
 * @property {Number} [logLevel] - See Loggr.LEVELS
 *
 * @property {FilterCallback} [captureFilter]
 * @property {FilterCallback} [pressKeyFilter] - Special capture filter, only called for pressKey. <b>Default: capture Enter, Esc only</b>.
 *
 * @property {OnChangeCallback} [onChangeEvent]
 *
 * @property {Array<Object>} [onSelectorBecameVisible]
 * @property {String} [onSelectorBecameVisible[].selector] - CSS selector
 * @property {SelectorBecameVisibleCallback} [onSelectorBecameVisible[].listener]
 *
 * @property {Array<OutputFormatter>} outputFormatters - Custom output and download formatter(s)
 * @property {String} [selectedOutputFormatter] - Selected output formatter name
 *
 * @property {Array<String>} [mouseoverSelectors] - Detect mouseover events only for these selectors
 *
 * @property {UniqueSelectorOptions} [uniqueSelectorOptions]
 *
 * @property {Array<String>|null} [compositeEvents = ['click', 'focus']] - subsequent events of specified types will be combined into a single composite event
 * @property {Number} [compositeEventsThreshold = 200] - composite events grouping threshold
 * @property {Function} [compositeEventsComparator] - default: full selector paths similar (a in b or b in a)
 *
 * @property {Array<Object>} [_mockMessages] - for testing only, do not use
 * @property {Boolean} [_preEnableRecording] - for testing only, do not use
 *
 * @property {String} recordedAppUrl
 */

// TODO rename to NostromoRecorder?

/**
 * @class
 * @param {RecorderOptions} conf
 */
function RecorderServer(conf) {
    this._conf = defaults({}, conf, {
        onSelectorBecameVisible: [],
        mouseoverSelectors: [],
        uniqueSelectorOptions: null,
        compositeEvents: ['click', 'focus'],
        compositeEventsThreshold: 200,
        compositeEventsComparator: defaultCompositeEventsComparator,
        _mockMessages: [],
    });

    if (this._conf.compositeEvents === null) {
        this._conf.compositeEvents = [];
    }

    // TODO assert conf
    // TODO check for configs not in default conf

    this._recorderAppServer = http.createServer(this._onRecRequest.bind(this));
    this._wsServer = new WS.Server({ server: this._recorderAppServer });

    this._log = new Loggr({
        namespace: 'RecorderServer',
        logLevel: this._conf.logLevel,
    });

    this._recorderUIBrowser=null
    this._recordedAppBrowser=null

    this._proxyMessage = this._proxyMessage.bind(this);
}

RecorderServer.prototype.start = async function () {
    this._recorderUIBrowser=await puppeteer.launch({
        headless:false,
        
    })
};

RecorderServer.prototype.stopX = async function () {
};

RecorderServer.prototype.startX = async function () {
    this._wsServer.on('connection', () => this._log.info('recorder app connected'));

    this._recorderAppServer.listen(this._conf.recorderAppPort);
    this._puppeteer.start();

    console.log(`--- Open the recording app in your browser: http://localhost:${this._conf.recorderAppPort} ---`);

    this._puppeteer.on(MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, this._proxyMessage);
    this._puppeteer.on(MESSAGES.UPSTREAM.CAPTURED_EVENT, this._proxyMessage);
    this._puppeteer.on(MESSAGES.UPSTREAM.INSERT_ASSERTION, this._proxyMessage);

    this._puppeteer.on('puppetConnected', async () => {
        try {

            // TODO create & use setPuppetSettings?

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

            if (this._conf.uniqueSelectorOptions) {
                await this._puppeteer.sendMessage({
                    type: MESSAGES.DOWNSTREAM.SET_UNIQUE_SELECTOR_OPTIONS,
                    options: this._conf.uniqueSelectorOptions,
                });
            }
        }
        catch (err) {
            this._log.error(err.stack || err.message);
        }
    });
};

RecorderServer.prototype.stopX = async function () {
    await this._puppeteer.stop()
    await new Promise(resolve=>this._recorderAppServer.close(resolve));
};

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

function defaultCompositeEventsComparator(cmd, lastNewCmd) {
    const $fsp1 = cmd.$fullSelectorPath;
    const $fsp2 = lastNewCmd.$fullSelectorPath;

    return $fsp1.indexOf($fsp2) >= 0 || $fsp2.indexOf($fsp1) >= 0;
}
