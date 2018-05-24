'use strict';

const pathlib = require('path');
const test = require('tape');
const WebSocket = require('ws');
const Testrunner = require('../../../src/testrunner/testrunner');

test('Testrunner: browser fails to start', async t => {
	const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,

        browsers: [
            {
            	name: 'DummyBrowser',
            	start: async () => { throw new Error('browser failed to start'); },
				isBrowserVisible: () => false,
				waitForBrowserVisible: noop,
				open: noop,
				stop: noop,
            }
        ],

        suites: [
            {
                name: 'My suite',
                appUrl: 'http://url-to-my-app.com/index.html',
                testFiles: [pathlib.resolve(__dirname, 'testrunner-test--testfile-noop.js')],
            },
        ],
	});

	testrunner._log._conf.logLevel = 0;

	await testrunner.run();
	t.pass('exits gracefully');

    t.end();
});

test('Testrunner: test throws', async t => {
	let wsClient;

	const testrunner = new Testrunner({
        testPort: 47225,
        testBailout: true,
        bailout: false,

        logLevel: 0,

        browsers: [
            {
            	name: 'DummyBrowser',
            	start: noop,
				isBrowserVisible: () => true,
				waitForBrowserVisible: noop,
				open: () => {
					wsClient = new WebSocket('ws://localhost:47225?puppet-id=6183683651617');
					wsClient.on('error', noop);
					wsClient.on('message', m => {
						wsClient.send(JSON.stringify({ type: 'ack' }));
					})
				},
				stop: noop,
            }
        ],

        suites: [
            {
                name: 'My suite',
                appUrl: 'http://url-to-my-app.com/index.html',
                testFiles: [pathlib.resolve(__dirname, 'testrunner-test--testfile-throws.js')],
            },
        ],
	});

	await testrunner.run();
	t.pass('exits gracefully');

    t.end();
});

// TODO before/after functions throw

function noop() {}