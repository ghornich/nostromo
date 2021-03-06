'use strict';

const rfr = require('rfr');
const pathlib = require('path');
const WebSocket = require('ws');
const Testrunner = require('../../../src/testrunner/testrunner');
const stream = require('stream');
const Chromium = rfr('modules/browser-spawner-chromium');
import createServer from '../../utils/create-server';

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
    let wsClient;

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
                open: () => {
                    wsClient = new WebSocket('ws://localhost:47225?puppet-id=6183683651617');
                    wsClient.on('error', noop);
                    wsClient.on('message', () => {
                        wsClient.send(JSON.stringify({ type: 'ack' }));
                    });
                },
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
            new Chromium({
                name: 'Chrome',
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
                beforeCommand: function (beforeCommandT) {
                    return beforeCommandT.waitWhileVisible('.loading, #toast');
                },
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../self-tests/testapp'), port: 16743 });
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

function noop() {}
