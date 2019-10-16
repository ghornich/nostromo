'use strict';

const util = require('util');
const spawn = require('child_process').spawn;
const BrowserSpanwerBase = require('../browser-spawner-base');

exports = module.exports = BrowserSpawnerChrome;

function BrowserSpawnerChrome(options) {
    BrowserSpanwerBase.call(this, options);
}

util.inherits(BrowserSpawnerChrome, BrowserSpanwerBase);

BrowserSpawnerChrome.prototype._startBrowser = async function (spawnerControlUrl) {
    if (this._process) {
        throw new Error('Process is already running');
    }

    // TODO what if folder exists?

    // params mostly from: https://github.com/karma-runner/karma-chrome-launcher/blob/master/index.js
    const params = [
        `--user-data-dir=${this._conf.tempDir}`,
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-device-discovery-notifications',
        '--incognito',
        '--start-maximized',

        // '--headless',
        // '--disable-gpu',
    ];

    params.push(spawnerControlUrl);

    this._process = spawn(this._conf.path, params);

    this._process.on('error', () => this.emit('error'));
    this._process.on('close', () => {
        this.emit('close');
        this._deleteTempDir();
    });
};

BrowserSpawnerChrome.prototype._getDefaultTempDir = function () {
    return `_chrome_temp_${Date.now()}`;
};
