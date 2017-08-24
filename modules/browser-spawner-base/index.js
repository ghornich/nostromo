'use strict';

const resolvePath = require('path').resolve;
const EventEmitter = require('events').EventEmitter;
const util = require('util');
const rimraf = require('rimraf');
const Loggr = require('../loggr');

const TEMP_DELETE_RETRIES = BrowserSpawnerBase.TEMP_DELETE_RETRIES = 3;
const TEMP_DELETE_TIMEOUT = BrowserSpawnerBase.TEMP_DELETE_TIMEOUT = 1000;

exports = module.exports = BrowserSpawnerBase;

/**
 * @typedef {Bounds}
 *
 * @property {Object} size - width and height properties as numbers
 * @property {Object} [position] - x and y properties as numbers. Defaults to 0, 0
 */

/**
 * @typedef {BrowserSpawnerOptions}
 *
 * @property {String} name - Display name for this browser
 * @property {String} path - Path to browser executable
 * @property {String} [tempDir] - Temporary profile dir path. Defaults to a random directory in cwd
 * @property {Bounds} [bounds] - Browser size and position. Defaults to fullscreen
 * @property {Object} [logger] - Custom Loggr instance
 */

/**
 * 
 * @param {BrowserSpawnerOptions} options - 
 */
function BrowserSpawnerBase(options) {
    EventEmitter.call(this);

    this._opts = options || {};
    this._opts.bounds = this._opts.bounds || null;
    this._opts.tempDir = resolvePath(this._opts.tempDir || this._getDefaultTempDir());
    this._log = options.logger || new Loggr({
        namespace: `[BrowserSpawner ${this._opts.name}]`,
    });

    this._process = null;
    this._processRunning = false;

    Object.defineProperty(this, 'name', {
        get: function () { return this._opts.name; }
    })
}

util.inherits(BrowserSpawnerBase, EventEmitter);

/**
 * 
 * @param {String} url - URL to open
 * @return {Promise}
 */
BrowserSpawnerBase.prototype.start = function () {
    return Promise.reject(new Error('BrowserSpawnerBase::start: not implemented'));
};

/**
 * 
 * @throws {Error}
 */
BrowserSpawnerBase.prototype.stop = function () {
    throw new Error('BrowserSpawnerBase::stop: not implemented');
};

/**
 * 
 * @param {String} eventName - 'close', 'error'
 * @param {Function} callback - Params: 'close' event: none; 'error' event: error
 */
// BrowserSpawnerBase.prototype.on = function () {
//     return Promise.reject(new Error('BrowserSpawnerBase::on: not implemented'))
// };

BrowserSpawnerBase.prototype._getDefaultTempDir = function () {
    throw new Error('BrowserSpawnerBase::_getDefaultTempDir: not implemented');
};

BrowserSpawnerBase.prototype._deleteTempDir = function () {
    // TODO delete all previous temp dirs too

    return new Promise((resolve) => {
        this._log.debug('BrowserSpawnerBase: deleting temp dir');

        let attempts = 0;

        const loop = () => {
            attempts++;

            if (attempts > TEMP_DELETE_RETRIES) {
                throw new Error('BrowserSpawnerBase: maximum retries reached');
            }

            rimraf(this._opts.tempDir, (maybeError) => {
                if (maybeError) {
                    this._log.debug(`BrowserSpawnerBase: deleting temp dir failed: ${maybeError}`);

                    setTimeout(loop, TEMP_DELETE_TIMEOUT);
                }
                else {
                    resolve();
                }
            });
        };

        loop();
    });
};
