import { WaitForOptions } from 'puppeteer';


/**
 * Responsible for the low-level control of a browser
 */
export interface IBrowser {
    name: string,

    // control
    start(): Promise<void>,
    stop(): Promise<void>,
    navigateTo(url: string, options?: WaitForOptions & { referer?: string; referrerPolicy?: string; }): Promise<void>,
    setViewport(options: { width: number, height: number }): Promise<void>,

    // commands
    click(selector: string): Promise<void>,
    focus(selector: string): Promise<void>,
    hover(selector: string): Promise<void>,
    type(selector: string, text: string): Promise<void>,
    pressKey(keyName: string): Promise<void>,
    // scrollBy(selector: string, amount: number): Promise<void>,
    scroll(selector: string, scrollTop: number): Promise<void>,
    scrollIntoView(selector: string): Promise<void>,
    execFunction(fn: Function, ...args: any[]): Promise<any>,

    // queries
    getValue(selector: string): Promise<string|boolean>,
    screenshot(options?: { selector?: string, fullPage?: boolean }): Promise<Buffer>,
    isVisible(selector: string): Promise<boolean>,

    // waiting
    waitForVisible(selector: string, options?: { timeout?: number, initialDelay?: number }): Promise<void>,
    waitWhileVisible(selector: string, options?: { timeout?: number, initialDelay?: number }): Promise<void>

    // TODO console pipe?
}
