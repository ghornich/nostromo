'use strict';

const pathlib = require('path');
const Testrunner = require('../../../src/testrunner/testrunner').default;
const stream = require('stream');
import createServer from '../../utils/create-server';
import Chromium from '../../../modules/browsers/chromium';
import { DummyBrowser } from './dummy-browser';

class NullStream extends stream.Writable {
    _write(chunk, encoding, cb) {
        setImmediate(cb);
    }
}

class NonFunctionalBrowser extends DummyBrowser {
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

        outStream: new NullStream(),

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

        outStream: new NullStream(),
        browsers: [
            new DummyBrowser(),
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

class BrowserRequiringThreeClicks extends DummyBrowser {
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

        outStream: new NullStream(),
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

    await testrunner.run();

    expect(process.exitCode === undefined || process.exitCode === 0).toBe(true);
}, 60 * 1000);

test('Testrunner: test command retries but fails', async () => {
    const testrunner = new Testrunner({
        testBailout: true,
        bailout: false,
        consoleLogLevel: 'info',
        fileLogLevel: null,

        outStream: new NullStream(),
        commandRetryCount: 1, // max tries: 1 + 1, and browser would require 3 tries

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
        fileLogLevel: null,

        outStream: new NullStream(),
        testRetryCount: 4,

        browsers: [
            new Chromium({
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
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../../../test/self-tests/testapp'), port: 16743 });
                },
                afterTest: async function () {
                    // @ts-expect-error
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
        ],
    });

    await testrunner.run();

    expect(process.exitCode === undefined || process.exitCode === 0).toBe(true);
}, 60 * 1000);