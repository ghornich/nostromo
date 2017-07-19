'use strict';

const rfr=require('rfr')
const util = require('util');
const spawn = require('child_process').spawn;
const BrowserSpanwerBase = rfr('modules/browser-spawner-base');

exports = module.exports = BrowserSpawnerChrome;

function BrowserSpawnerChrome(options) {
    BrowserSpanwerBase.call(this, options);
}

util.inherits(BrowserSpawnerChrome, BrowserSpanwerBase);

BrowserSpawnerChrome.prototype.start = function (url) {
    if (this._processRunning) {
        throw new Error('Process is already running');
    }

    // TODO what if folder exists?

    // params mostly from: https://github.com/karma-runner/karma-chrome-launcher/blob/master/index.js
    const params = [
        `--user-data-dir=${this._opts.tempDir}`,
        '--no-default-browser-check',
        '--no-first-run',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-device-discovery-notifications',

        // TODO?
        // '--headless',
        // '--disable-gpu',
    ];

    if (this._opts.bounds) {
        const size = this._opts.bounds.size;
        const position = this._opts.bounds.position;

        params.push(`--window-size=${size.width},${size.height}`);

        if (position) {
            params.push(`--window-position=${position.x},${position.y}`);
        }
    }
    else {
        params.push('--start-maximized');
    }

    params.push(url);

    this._process = spawn(this._opts.path, params);
    this._processRunning = true;

    this._process.on('error', () => this.emit('error'));
    this._process.on('close', () => {
        this.emit('close');
        this._deleteTempDir();
    });
};

BrowserSpawnerChrome.prototype.stop = function () {
    if (this._processRunning) {
        this._process.kill();
    }
    else {
        throw new Error('Process is not running');
    }
};

BrowserSpawnerChrome.prototype._getDefaultTempDir = function () {
    return `_chrome_temp_${Date.now()}`;
};
