import puppeteer, { KeyInput } from 'puppeteer';
import type { IBrowser } from './browser-interface';
import { WaitForOptions } from 'puppeteer';
type ChromiumOptions = {
    name?: string;
    headless?: boolean;
    width: number;
    height: number;
    /** Custom version of puppeteer */
    puppeteer?: typeof puppeteer;
};
export default class Chromium implements IBrowser {
    private _options;
    private _browser;
    private _puppeteer;
    private _log;
    get name(): string;
    constructor(options: ChromiumOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    _closeAllPages(): Promise<void>;
    navigateTo(url: string, options?: WaitForOptions & {
        referer?: string;
        referrerPolicy?: string;
    }): Promise<void>;
    setViewport(options: {
        width: number;
        height: number;
    }): Promise<void>;
    click(selector: string): Promise<void>;
    focus(selector: string): Promise<void>;
    hover(selector: string): Promise<void>;
    type(selector: string, text: string): Promise<void>;
    pressKey(keyName: KeyInput): Promise<void>;
    scroll(selector: string, scrollTop: number): Promise<void>;
    scrollIntoView(selector: string): Promise<void>;
    execFunction(fn: Function, ...args: any[]): Promise<any>;
    getValue(selector: string): Promise<string | boolean>;
    screenshot({ selector, fullPage }?: {
        selector?: string;
        fullPage?: boolean;
    }): Promise<Uint8Array>;
    isVisible(selector: string): Promise<boolean>;
    waitForVisible(selector: string, options?: {
        timeout?: number;
        initialDelay?: number;
    }): Promise<void>;
    waitWhileVisible(selector: string, options?: {
        timeout?: number;
        initialDelay?: number;
    }): Promise<void>;
    private getPage;
}
export {};
