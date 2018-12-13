'use strict';

const test = require('tape');
const WebSocket = require('ws');
const BrowserPuppeteer = require('../../../modules/browser-puppeteer').BrowserPuppeteer;
const MESSAGES = require('../../../modules/browser-puppeteer').MESSAGES;
const delay = require('../../../modules/delay');

const LOGLEVEL = 0;

test('BrowserPuppeteer: force close active connections', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    const wsConn = new WebSocket('ws://localhost:51480?puppet-id=7317574082848');
    await new Promise(resolve => wsConn.on('open', resolve));

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: missing puppet id', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    const wsConn = new WebSocket('ws://localhost:51480');
    const error = await new Promise(resolve => wsConn.on('error', resolve));
    t.ok(/unexpected server response \(400\)/.test(error.message), 'wsConn error message');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: blacklisted puppet id', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();
    puppeteer._puppetIdBlacklist.add(7317574082848);

    const wsConn = new WebSocket('ws://localhost:51480?puppet-id=7317574082848');
    const error = await new Promise(resolve => wsConn.on('error', resolve));
    t.ok(/unexpected server response \(400\)/.test(error.message), 'wsConn error message');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: valid connection', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    const wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');

    await new Promise(resolve => wsConn.on('open', resolve));
    t.pass('connection');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: already connected', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    const validConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');
    await new Promise(resolve => validConn.on('open', resolve));
    t.pass('validConn connection');

    const invalidConn = new WebSocket('ws://localhost:51480?puppet-id=6674262315383');
    const error = await new Promise(resolve => invalidConn.on('error', resolve));
    t.ok(/unexpected server response \(400\)/.test(error.message), 'invalidConn error');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: client restart', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    let wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');

    await new Promise(resolve => wsConn.on('open', resolve));

    wsConn.terminate();

    await delay(500);

    wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');

    await new Promise(resolve => wsConn.on('open', resolve));
    t.pass('client restart');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: deferred messaging', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    const commandPromise = puppeteer.execCommand({ type: 'dummy-command' });

    await delay(2000);
    const wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');

    wsConn.on('message', message => {
        const data = JSON.parse(message);
        wsConn.send(JSON.stringify({ type: MESSAGES.UPSTREAM.ACK, result: 'dummy-command-ok' }));
    });

    t.equal(await commandPromise, 'dummy-command-ok');

    await puppeteer.stop();
    t.end();
});

test('BrowserPuppeteer: terminateConnection', async t => {
    const puppeteer = new BrowserPuppeteer({ port: 51480 });
    puppeteer._log._conf.logLevel = LOGLEVEL;
    await puppeteer.start();

    let wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');
    await new Promise(resolve => wsConn.on('open', resolve));

    puppeteer.terminateConnection();

    wsConn = new WebSocket('ws://localhost:51480?puppet-id=1044188020788');
    const error = await new Promise(resolve => wsConn.on('error', resolve));
    t.ok(/unexpected server response \(400\)/.test(error.message), 'wsConn error message');

    await puppeteer.stop();
    t.end();
});
