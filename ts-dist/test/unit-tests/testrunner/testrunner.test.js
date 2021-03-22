'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pathlib = require('path');
const Testrunner = require('../../../src/testrunner/testrunner').default;
const stream = require('stream');
const create_server_1 = __importDefault(require("../../utils/create-server"));
const chromium_1 = __importDefault(require("../../../modules/browsers/chromium"));
class NullStream extends stream.Writable {
    _write(chunk, encoding, cb) {
        setImmediate(cb);
    }
}
test('Testrunner: browser fails to start', async () => {
    const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,
        outStream: new NullStream(),
        browsers: [
            {
                name: 'DummyBrowser',
                start: async () => {
                    throw new Error('browser failed to start');
                },
                isBrowserVisible: () => false,
                waitForBrowserVisible: noop,
                open: noop,
                stop: noop,
            },
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
        testPort: 47225,
        testBailout: true,
        bailout: false,
        outStream: new NullStream(),
        logLevel: 'off',
        browsers: [
            {
                name: 'DummyBrowser',
                start: noop,
                isBrowserVisible: () => true,
                waitForBrowserVisible: noop,
                open: noop,
                stop: noop,
            },
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
test('Testrunner: test retries', async () => {
    const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,
        outStream: new NullStream(),
        logLevel: 'off',
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
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
        ],
    });
    await testrunner.run();
    expect(process.exitCode === undefined || process.exitCode === 0).toBe(true);
}, 60 * 1000);
// TODO before/after functions throw
function noop() { }
