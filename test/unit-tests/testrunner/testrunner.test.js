'use strict';

const rfr = require('rfr');
const pathlib = require('path');
const test = require('tape');
const WebSocket = require('ws');
const Testrunner = require('../../../src/testrunner/testrunner');
const stream = require('stream');
const Chrome = rfr('modules/browser-spawner-chrome');

global.retryLogicTestRuns = 0;

class NullStream extends stream.Writable {
    _write(chunk, encoding, cb) {
        setImmediate(cb);
    }
}

test.skip('Testrunner: browser fails to start', async t => {
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

    t.ok(process.exitCode > 0);
    process.exitCode = 0;
    t.pass('exits gracefully');

    t.end();
});

test.skip('Testrunner: test throws', async t => {
    let wsClient;

    const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,

        // outStream: new NullStream(),

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
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-retry-logic.js'),
                ],
            },
        ],
    });

    await testrunner.run();

    t.ok(process.exitCode > 0);
    process.exitCode = 0;
    t.pass('exits gracefully');

    t.end();
});

test('Testrunner: test retries', async t => {
    const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,

        // outStream: new NullStream(),

        logLevel:2000,
        testRetryCount: 4,

        browsers: [
            new Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                width: 750,
                height: 550,
            }),
        ],

        suites: [
            {
                name: 'My suite',
                appUrl: 'file:///' + pathlib.resolve(__dirname, '..\\..\\self-tests\\testapp\\index.html'),
                testFiles: [
                    pathlib.resolve(__dirname, 'testrunner-test--testfile-retry-logic.js'),
                ],
                beforeCommand: function (beforeCommandT) {
                    return beforeCommandT.waitWhileVisible('.loading, #toast');
                },
            },
        ],
    });

    await testrunner.run();

    t.ok(process.exitCode === undefined || process.exitCode === 0);
    t.pass('retry succeeded');

    t.end();
});

// TODO before/after functions throw

function noop() {}
