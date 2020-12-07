const puppeteer = require('puppeteer');
const BrowserSpawnerBase = require('../browser-spawner-base');
const Bitmap = require('../pnglib').Bitmap;
const bufferImageSearch = require('../buffer-image-search');
const bufferImageCrop = require('../buffer-image-crop');

const VIEWPORT_PADDING_PX = 10;

/**
 * @typedef BrowserSpawnerConfig
 *
 * @property {String} name - Display name for this browser
 * @property {Number} width - Recorded app viewport width
 * @property {Number} height - Recorded app viewport height
 * @property {Object} [logger] - Custom Loggr instance
 * @property {Number} [waitForConnectionTimeoutMs = 60000]
 * @property {Number} [waitForConnectionPollIntervalMs = 500]
 * @property {Number} [visibilityTimeoutMs = 60000]
 * @property {Number} [visibilityPollIntervalMs = 3000]
 * @property {boolean} [headless=false]
 */

class ChromiumPuppeteerSpawner extends BrowserSpawnerBase {

    /**
    * @param {BrowserSpawnerConfig} conf
    */
    constructor(conf) {
        super(conf);

        this._browser = null;
        this._contextPage = null;
    }

    async _startBrowser(contextUrl) {
        this._browser = await puppeteer.launch({
            headless: this._conf.headless,
            defaultViewport: {
                width: this._conf.width + VIEWPORT_PADDING_PX,
                height: this._conf.height + VIEWPORT_PADDING_PX,
            },
            ignoreDefaultArgs: ['--enable-automation'],
            args: [
                '--incognito',
                '--start-maximized',
                '--no-default-browser-check',
                '--no-first-run',
                '--disable-translate',
            ],
        });

        this._contextPage = (await this._browser.pages())[0];

        await this._contextPage.bringToFront();
        await delay(100);
        await this._contextPage.goto(contextUrl);
        await delay(1000);
    }

    async isBrowserVisible() {
        return true;
    }

    async waitForBrowserVisible() {
        return delay(2000);
    }

    async getScreenshot(opts) {
        const screenshotPNGBuf = await this._contextPage.screenshot();
        const screenshotBitmap = await Bitmap.from(screenshotPNGBuf);

        if (opts && opts.cropMarker) {
            const markerPositions = bufferImageSearch(screenshotBitmap, opts.cropMarker);

            if (markerPositions.length !== 2) {
                throw new Error(`Marker count is not 2! Found ${markerPositions.length}`);
            }

            const cropDimensions = {
                x: markerPositions[0].x + opts.cropMarker.width,
                y: markerPositions[0].y + opts.cropMarker.height,
                width: markerPositions[1].x - markerPositions[0].x - opts.cropMarker.width,
                height: markerPositions[1].y - markerPositions[0].y - opts.cropMarker.height,
            };

            return bufferImageCrop(screenshotBitmap, cropDimensions);
        }

        return screenshotBitmap;
    }

    async _deleteTempDir() {
        // no op
    }

    _getDefaultTempDir() {
        return '';
    }

    async stop() {
        if (this._wsServer) {
            await new Promise(resolve => this._wsServer.close(resolve));
            this._wsServer = null;
        }

        await new Promise(res => this._httpServer.close(res));

        // close all pages before closing browser (https://github.com/puppeteer/puppeteer/issues/6341#issuecomment-739149141)
        for (const page of (await this._browser.pages())) {
            await page.close();
        }

        await this._browser.close();
        this._browser = null;
        this._contextPage = null;

        this._wsConn = null;
    }
}

async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

module.exports = ChromiumPuppeteerSpawner;
