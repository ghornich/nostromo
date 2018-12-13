'use strict';

const util = require('util');
const spawn = require('child_process').spawn;
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const BrowserSpanwerBase = require('../browser-spawner-base');
const resolvePath = require('path').resolve;
const mkdirpAsync = Promise.promisify(require('mkdirp'));

exports = module.exports = BrowserSpawnerFirefox;

// From https://github.com/karma-runner/karma-firefox-launcher/blob/master/index.js
const PREF_DEFAULT =
`user_pref('browser.shell.checkDefaultBrowser', false);
user_pref('browser.bookmarks.restore_default_bookmarks', false);
user_pref('dom.disable_open_during_load', false);
user_pref('dom.max_script_run_time', 0);
user_pref('dom.min_background_timeout_value', 10);
user_pref('extensions.autoDisableScopes', 0);
user_pref('browser.tabs.remote.autostart', false);
user_pref('browser.tabs.remote.autostart.2', false);
user_pref('extensions.enabledScopes', 15);
user_pref("signon.rememberSignons", false);
user_pref("browser.customizemode.tip0.shown", true);
user_pref("browser.search.suggest.enabled", false);
`;

function BrowserSpawnerFirefox(options) {
    BrowserSpanwerBase.call(this, options);
}

util.inherits(BrowserSpawnerFirefox, BrowserSpanwerBase);

BrowserSpawnerFirefox.prototype._startBrowser = async function (spawnerControlUrl) {
    if (this._process) {
        throw new Error('Process is already running');
    }

    // TODO what if folder exists?

    const prefsPath = resolvePath(this._conf.tempDir, 'prefs.js');

    const xulstoreObj = {
        'chrome://browser/content/browser.xul': {
            'main-window': { sizemode: 'maximized' },
        },
    };

    const xulstorePath = resolvePath(this._conf.tempDir, 'xulstore.json');

    await mkdirpAsync(this._conf.tempDir);
    await fs.writeFileAsync(prefsPath, PREF_DEFAULT);
    await fs.writeFileAsync(xulstorePath, JSON.stringify(xulstoreObj));

    let selectedPath = this._conf.path;

    if (Array.isArray(selectedPath)) {
        for (const path of this._conf.path) {
            try {
                await fs.statAsync(path);
                selectedPath = path;
            }
            catch (error) {
                // ignore
            }
        }
    }

    this._log.info(`using path "${selectedPath}"`);

    this._process = spawn(selectedPath, ['-profile', this._conf.tempDir, '-no-remote', spawnerControlUrl]);

    this._process.on('error', err => {
        this.emit('error', err);
    });

    this._process.on('close', () => {
        this.emit('close');
        this._deleteTempDir();
    });
};

BrowserSpawnerFirefox.prototype._getDefaultTempDir = function () {
    return `_firefox_temp_${Date.now()}`;
};
