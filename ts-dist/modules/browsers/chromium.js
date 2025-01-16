"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const logger_1 = require("../../src/logging/logger");
const delay = require('../delay/delay');
const DEFAULT_OPTIONS = { name: 'chromium', headless: true };
const DEFAULT_VISIBILITY_TIMEOUT = 30000;
const DEFAULT_WAIT_INITIAL_DELAY = 100;
const DEFAULT_WAIT_POLL_INTERVAL = 250;
class Chromium {
    get name() {
        return this._options.name;
    }
    constructor(options) {
        var _a;
        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._browser = null;
        this._puppeteer = (_a = options.puppeteer) !== null && _a !== void 0 ? _a : puppeteer_1.default;
        this._log = logger_1.logger.childLogger('Chromium');
    }
    async start() {
        this._browser = await this._puppeteer.launch({
            headless: this._options.headless,
            defaultViewport: {
                width: this._options.width,
                height: this._options.height,
            },
            ignoreDefaultArgs: ['--enable-automation', '--hide-scrollbars'],
            args: [
                '--incognito',
                '--start-maximized',
                '--no-default-browser-check',
                '--no-first-run',
                '--disable-translate',
            ],
        });
        (await this.getPage()).on('console', event => {
            const type = event.type();
            const message = `ConsolePipe - ${event.type()} ${event.text()}`;
            if (type === 'error') {
                this._log.error(message);
            }
            else if (type === 'warn' || type === 'assert') {
                this._log.warn(message);
            }
            else if (type === 'info') {
                this._log.verbose(message);
            }
            else if (type === 'trace' || type === 'profile') {
                this._log.debug(message);
            }
            else {
                this._log.verbose(message);
            }
        });
    }
    async stop() {
        await this._closeAllPages();
        await this._browser.close();
    }
    async _closeAllPages() {
        const pages = await this._browser.pages();
        await Promise.all(pages.map(page => page.close()));
    }
    async navigateTo(url, options) {
        await (await this.getPage()).goto(url, options);
    }
    async setViewport(options) {
        await (await this.getPage()).setViewport(options);
    }
    async click(selector) {
        await (await this.getPage()).click(selector);
    }
    async focus(selector) {
        await (await this.getPage()).focus(selector);
    }
    async hover(selector) {
        await (await this.getPage()).hover(selector);
    }
    async type(selector, text) {
        await (await this.getPage()).type(selector, text);
    }
    async pressKey(keyName) {
        await (await this.getPage()).keyboard.press(keyName);
    }
    async scroll(selector, scrollTop) {
        await (await this.getPage()).evaluate(function (sel, sTop) {
            // @ts-expect-error
            document.querySelector(sel).scrollTop = sTop;
        }, selector, scrollTop);
    }
    async scrollIntoView(selector) {
        await (await this.getPage()).evaluate(function (sel) {
            // @ts-expect-error
            document.querySelector(sel).scrollIntoView();
        }, selector);
    }
    async execFunction(fn, ...args) {
        // @ts-expect-error
        return (await this.getPage()).evaluate(fn, ...args);
    }
    async getValue(selector) {
        return (await this.getPage()).evaluate(function (sel) {
            // @ts-expect-error
            const node = document.querySelector(sel);
            if (node === null) {
                throw new Error(`getValue: selector not found: ${sel}`);
            }
            if (node.tagName === 'INPUT' && node.type === 'checkbox') {
                return node.checked;
            }
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
                return node.value;
            }
            return node.innerText;
        }, selector);
    }
    async screenshot({ selector, fullPage } = {}) {
        const page = await this.getPage();
        if (selector) {
            const elem = await page.$(selector);
            if (elem === null) {
                throw new Error(`screenshot: selector not found: ${selector}`);
            }
            return elem.screenshot({ encoding: 'binary' });
        }
        return page.screenshot({ encoding: 'binary', fullPage });
    }
    async isVisible(selector) {
        try {
            return await (await this.getPage()).evaluate(function (sel) {
                // @ts-expect-error
                const nodes = document.querySelectorAll(sel);
                if (nodes.length === 0) {
                    return false;
                }
                const hasVisible = [...nodes].some(node => {
                    // @ts-expect-error
                    const computedStyle = window.getComputedStyle(node);
                    return computedStyle.getPropertyValue('display') !== 'none' && computedStyle.getPropertyValue('visibility') !== 'hidden';
                });
                if (!hasVisible) {
                    return false;
                }
                for (const node of nodes) {
                    const rect = node.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    // @ts-expect-error
                    const elementFromPoint = document.elementFromPoint(centerX, centerY);
                    if (elementFromPoint === node || node.contains(elementFromPoint)) {
                        return true;
                    }
                }
                return false;
            }, selector);
        }
        catch (err) {
            this._log.warn(err);
            return false;
        }
    }
    async waitForVisible(selector, options = {}) {
        options.timeout = options.timeout !== undefined ? options.timeout : DEFAULT_VISIBILITY_TIMEOUT;
        options.initialDelay = options.initialDelay !== undefined ? options.initialDelay : DEFAULT_WAIT_INITIAL_DELAY;
        const timeoutTime = Date.now() + (options.timeout);
        await delay(options.initialDelay);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (await this.isVisible(selector)) {
                return;
            }
            if (Date.now() >= timeoutTime) {
                throw new Error(`waitForVisible: timeout, selector: ${selector}`);
            }
            await delay(DEFAULT_WAIT_POLL_INTERVAL);
        }
    }
    async waitWhileVisible(selector, options = {}) {
        options.timeout = options.timeout !== undefined ? options.timeout : DEFAULT_VISIBILITY_TIMEOUT;
        options.initialDelay = options.initialDelay !== undefined ? options.initialDelay : DEFAULT_WAIT_INITIAL_DELAY;
        const timeoutTime = Date.now() + (options.timeout);
        await delay(options.initialDelay);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (!await this.isVisible(selector)) {
                return;
            }
            if (Date.now() >= timeoutTime) {
                throw new Error(`waitWhileVisible: timeout, selector: ${selector}`);
            }
            await delay(DEFAULT_WAIT_POLL_INTERVAL);
        }
    }
    async getPage() {
        return (await this._browser.pages())[0];
    }
}
exports.default = Chromium;
