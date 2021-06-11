/// <reference types="node" />
import { IBrowser } from "../../../src";
export declare class DummyBrowser implements IBrowser {
    name: string;
    start(): Promise<void>;
    stop(): Promise<void>;
    navigateTo(): Promise<void>;
    setViewport(): Promise<void>;
    click(): Promise<void>;
    focus(): Promise<void>;
    hover(): Promise<void>;
    type(): Promise<void>;
    pressKey(): Promise<void>;
    scroll(): Promise<void>;
    scrollIntoView(): Promise<void>;
    execFunction(): Promise<void>;
    getValue(): Promise<string>;
    screenshot(): Promise<Buffer>;
    isVisible(): Promise<boolean>;
    waitForVisible(): Promise<void>;
    waitWhileVisible(): Promise<void>;
}
