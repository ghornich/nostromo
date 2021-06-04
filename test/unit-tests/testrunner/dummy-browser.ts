import { IBrowser } from "../../../src";

export class DummyBrowser implements IBrowser {
    name = 'DummyBrowser';
    async start() {}
    async stop() {}
    async navigateTo() {}
    async setViewport() {}
    async click() {}
    async focus() {}
    async hover() {}
    async type() {}
    async pressKey() {}
    async scroll() {}
    async scrollIntoView() {}
    async execFunction() {}
    // queries
    async getValue() {
        return '';
    }
    async screenshot() {
        // single pixel red bmp
        return Buffer.from('424d1e000000000000001a0000000c00000001000100010018000000ff00', 'hex');
    }
    async isVisible() {
        return true;
    }
    // waiting
    async waitForVisible() {}
    async waitWhileVisible() {}
}