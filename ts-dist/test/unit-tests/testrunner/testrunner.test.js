'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathlib = require('path');
const Testrunner = require('../../../src/testrunner/testrunner').default;
const create_server_1 = __importDefault(require("../../utils/create-server"));
const chromium_1 = __importDefault(require("../../../modules/browsers/chromium"));
const dummy_browser_1 = require("./dummy-browser");
class NonFunctionalBrowser extends dummy_browser_1.DummyBrowser {
    async start() {
        throw new Error('browser failed to start');
    }
}
test('Testrunner: browser fails to start', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        fileLogLevel: null,
        browsers: [
            new NonFunctionalBrowser(),
        ],
        suites: [
            {
                name: 'My suite',
                appUrl: 'http://url-to-my-app.com/index.html',
                testFiles: [pathlib.resolve(__dirname, 'testrunner-test--testfile-noop.js')],
            },
        ],
    });
    await testrunner.run();
    expect(process.exitCode).toBeGreaterThan(0);
    process.exitCode = 0;
});
test('Testrunner: test throws', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        fileLogLevel: null,
        browsers: [
            new dummy_browser_1.DummyBrowser(),
        ],
        suites: [
            {
                name: 'My suite',
                appUrl: 'http://url-to-my-app.com/index.html',
                testFiles: [
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-throws.js'),
                ],
            },
        ],
    });
    await testrunner.run();
    expect(process.exitCode).toBeGreaterThan(0);
    process.exitCode = 0;
});
class BrowserRequiringThreeClicks extends dummy_browser_1.DummyBrowser {
    constructor() {
        super();
        this.clicks = 0;
    }
    async click() {
        this.clicks++;
        if (this.clicks !== 3) {
            throw new Error('Click some more!');
        }
    }
}
test('Testrunner: test command retries', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        fileLogLevel: null,
        testRetryCount: 3,
        browsers: [
            new BrowserRequiringThreeClicks(),
        ],
        suites: [
            {
                name: 'My suite',
                appUrl: 'http://localhost:666/index.html',
                testFiles: [
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-retry-logic.js'),
                ],
            },
        ],
    });
    process.exitCode = 0;
    await testrunner.run();
    expect(process.exitCode).toBe(0);
}, 60 * 1000);
test('Testrunner: test command retries but fails', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        fileLogLevel: null,
        commandRetryCount: 1,
        browsers: [
            new BrowserRequiringThreeClicks(),
        ],
        suites: [
            {
                name: 'My suite',
                appUrl: 'http://localhost:666/index.html',
                testFiles: [
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-retry-logic.js'),
                ],
            },
        ],
    });
    await testrunner.run();
    expect(process.exitCode).toBe(1);
}, 60 * 1000);
// TODO before/after functions throw
test('Testrunner: integration test', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        // fileLogLevel: null,
        testRetryCount: 4,
        browsers: [
            new chromium_1.default({
                width: 750,
                height: 550,
                headless: true,
            }),
        ],
        suites: [
            {
                name: 'My suite',
                appUrl: 'http://localhost:16743/index.html',
                testFiles: [
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-retry-logic.js'),
                ],
                beforeCommand: async function (t) {
                    await t.waitWhileVisible('.loading, #toast');
                },
                beforeTest: async function () {
                    this.server = await create_server_1.default({ dirToServe: pathlib.resolve(__dirname, '../../../../test/self-tests/testapp'), port: 16743 });
                },
                afterTest: async function () {
                    // @ts-expect-error
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
        ],
    });
    process.exitCode = 0;
    await testrunner.run();
    expect(process.exitCode).toBe(0);
}, 60 * 1000);
