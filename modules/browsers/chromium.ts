import puppeteer from 'puppeteer';
import type { IBrowser } from './browser-interface';
const delay = require('../delay/delay');

const DEFAULT_OPTIONS = { name: 'chromium', headless: true };
const DEFAULT_VISIBILITY_TIMEOUT = 30000;
const DEFAULT_WAIT_INITIAL_DELAY = 100;
const DEFAULT_WAIT_POLL_INTERVAL = 250;

type ChromiumOptions = {
    name?: string,
    headless?: boolean,
    width: number,
    height: number
}

export default class Chromium implements IBrowser {
    _running: boolean
    _options: ChromiumOptions
    _browser: puppeteer.Browser
    _page: puppeteer.Page

    get name() {
        return this._options.name;
    }

    constructor(options: ChromiumOptions) {
        this._options = { ...DEFAULT_OPTIONS, ...options };
        this._browser = null;
        this._page = null;
    }

    async start() {
        this._browser = await puppeteer.launch({
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

        this._page = (await this._browser.pages())[0];

        // TODO remove this? or use as consolePipe
        this._page.on('console', event => {
            console.log('ConsolePipe - ', event.type(), event.text());
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

    async navigateTo(url: string) {
        await this._page.goto(url);
    }

    async setViewport(options: { width: number, height: number }) {
        await this._page.setViewport(options);
    }

    async click(selector: string) {
        await this._page.click(selector);
    }

    async focus(selector: string) {
        await this._page.focus(selector);
    }

    async hover(selector: string) {
        await this._page.hover(selector);
    }

    async type(selector: string, text: string) {
        await this._page.type(selector, text);
    }

    async pressKey(keyName: string) {
        await this._page.keyboard.press(keyName);
    }

    async scroll(selector: string, scrollTop: number) {
        await this._page.evaluate(function (sel, sTop) {
            // @ts-expect-error
            document.querySelector(sel).scrollTop = sTop;
        }, selector, scrollTop);
    }

    async scrollIntoView(selector: string) {
        await this._page.evaluate(function (sel) {
            // @ts-expect-error
            document.querySelector(sel).scrollIntoView();
        }, selector);
    }

    async execFunction(fn: Function, ...args: any[]): Promise<any> {
        // @ts-expect-error
        return this._page.evaluate(fn, ...args);
    }

    async getValue(selector: string): Promise<string|boolean> {
        return this._page.evaluate(function (sel) {
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

    async screenshot(): Promise<Buffer> {
        // TODO implement selector, get boundingclientrect, etc

        return this._page.screenshot({ encoding: 'binary' });
    }

    async isVisible(selector: string): Promise<boolean> {
        const result = await this._page.evaluate(function (sel) {
            // @ts-expect-error
            const nodes: NodeList = document.querySelectorAll(sel);

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

        return result;
    }

    async waitForVisible(selector: string, options: { timeout?: number, initialDelay?: number } = {}) {
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

    async waitWhileVisible(selector: string, options: { timeout?: number, initialDelay?: number } = {}) {
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
}
