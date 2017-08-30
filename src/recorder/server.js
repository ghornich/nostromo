const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
const BrowserPuppeteer = require(`${MODULES_PATH}browser-puppeteer`).BrowserPuppeteer;
const MESSAGES = require(`${MODULES_PATH}browser-puppeteer`).MESSAGES;
const WS = require('ws');
const http = require('http');
const fs = Promise.promisifyAll(require('fs'));
const JSONF = require(`${MODULES_PATH}jsonf`);
const pathlib = require('path');
const Loggr = require(`${MODULES_PATH}loggr`);
const defaults = require('lodash.defaults');

const DEFAULT_RECORDER_APP_PORT = 7700;

module.exports = Server;

/**
 * @typedef {Object} BeforeCaptureArgs
 * TODO
 */

/**
 * @typedef {Array} SelectorBecameVisibleArgs
 * TODO
 */

/**
 * Recorder server
 * @param {Object} [conf]
 * @param {Number} [conf.recorderAppPort=7700]
 * @param {Number} [conf.logLevel] - See Loggr
 * @param {Function} [conf.beforeCapture] - Argument: {@link BeforeCaptureArgs}
 * @param {SelectorBecameVisibleArgs} [conf.onSelectorBecameVisible] - 
 * @param {String[]} [conf.mouseoverSelectors] - 
 * @param {String[]} [conf.ignoredClasses] - 
 * @param {Function} [conf.pressKeyFilter] - 
 * @param {Function[]} [conf.outputFormatters] - 
 * @param {String} [conf.selectedOutputFormatter] - 
 */
function Server(conf) {
    this._conf = defaults({}, conf, {
        recorderAppPort: DEFAULT_RECORDER_APP_PORT,
        // logLevel
        beforeCapture: noop,
        onSelectorBecameVisible: [],
        mouseoverSelectors: [],
        ignoredClasses: [],
        // pressKeyFilter
        // outputFormatters
        // selectedOutputFormatter
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

// TODO better promise chain?
Server.prototype.start = Promise.method(function () {
    this._wsServer.on('connection', () => this._log.info('recorder app connected'));

    this._recServer.listen(this._conf.recorderAppPort);
    this._puppeteer.start();

    console.log(`--- Open the recording app in your browser: http://localhost:${this._conf.recorderAppPort} ---`);
    // TODO add "open the tested app" text

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
            console.log(err);
        }
    });
});

Server.prototype._proxyMessage = function (data, rawData) {
    if (this._wsServer.clients.size === 1) {
        this._wsServer.clients.forEach(wsConn => wsConn.send(rawData));
    }
    else {
        this._log.debug(`_proxyMessage warning: invalid recording app connection count: ${this._wsServer.clients.size}`);
    }
};

Server.prototype._onRecRequest = async function (req, resp) {
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

/* Server.prototype.=function(){

}*/

/* Server.prototype.=function(){

}*/


function noop() {}
