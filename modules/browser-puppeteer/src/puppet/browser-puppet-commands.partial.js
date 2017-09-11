'use strict';

var assert = require('assert');
var Promise = require('bluebird');
var promiseWhile = require('../../../../modules/promise-while')(Promise);
var base64ToFile = require('../../../../modules/base64-to-file');
var lodashSet = require('lodash.set');

/**
 * @type {String}
 * @memberOf BrowserPuppetCommands
 */
var DEFAULT_UPLOAD_FILE_MIME = 'application/octet-stream';

exports = module.exports = BrowserPuppetCommands;

/**
 * @memberOf BrowserPuppetCommands
 * @typedef {Object} Command
 */

/**
 * @typedef {Command} CompositeCommand
 * @property {String} type - 'composite'
 * @property {Array<Command>} commands
 */

/**
 * @class
 * @abstract
 */
function BrowserPuppetCommands() {
    throw new Error('Can\'t create instance of abstract class "BrowserPuppetCommands"');
}

/**
 * @typedef {Command} ScrollCommand
 * @property {String} type - 'scroll'
 * @property {String} selector
 * @property {Number} scrollTop
 */

/**
 * @param {ScrollCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.scroll = function (cmd) {
    var $el = this.$(cmd.selector);
    this._assert$el($el, 'scroll');
    $el[0].scrollTop = cmd.scrollTop;
};

/**
 * @typedef {Command} MouseoverCommand
 * @property {String} type - 'mouseover'
 * @property {String} selector
 */

/**
 * @param {MouseoverCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.mouseover = function (cmd) {
    this._log.trace('BrowserPuppetCommands::mouseover: ' + JSON.stringify(cmd));

    var $el = this.$(cmd.selector);
    this._assert$el($el, 'mouseover');

    var mouseoverEvent = new Event('mouseover');
    $el[0].dispatchEvent(mouseoverEvent);
};

/**
 * @typedef {Command} WaitForVisibleCommand
 * @property {String} type - 'waitForVisible'
 * @property {String} selector
 * @property {Number} [pollInterval = 500]
 * @property {Number} [timeout = 10000]
 */

/**
 * Waits for selector to become visible
 *
 * @param {WaitForVisibleCommand} cmd
 * @return {Promise}
 */
BrowserPuppetCommands.prototype.waitForVisible = function (cmd) {
    var self = this;

    return Promise.try(function () {
        var pollInterval =  _defaultNum(cmd.pollInterval, 500);
        var timeout = _defaultNum(cmd.timeout, 10000);

        var isTimedOut = false;

        self._log.debug('waitForVisible: starting');

        if (self.isSelectorVisible(cmd.selector)) {
            self._log.debug('waitForVisible: selector wasn\'t visible: ' + cmd.selector);
            return;
        }

        setTimeout(function () {
            isTimedOut = true;
        }, timeout);

        return promiseWhile(
            function () {
                var result = self.isSelectorVisible(cmd.selector);
                self._log.debug('waitForVisible: visibility: ' + cmd.selector + ', ' + result);
                return !result;
            },
            function () {
                if (isTimedOut) {
                        var msg = 'waitForVisible: timed out (time: ' + timeout + 'ms, selector: "' + cmd.selector + '")';
                        self._log.error(msg);
                        throw new Error(msg);
                }

                self._log.debug('waitForVisible: delaying');
                return Promise.delay(pollInterval);
            }
        );
    });
};

/**
 * @typedef {Command} WaitWhileVisibleCommand
 * @property {String} type - 'waitWhileVisible'
 * @property {String} selector
 * @property {Number} [pollInterval = 500]
 * @property {Number} [initialDelay = 500]
 * @property {Number} [timeout = 10000]
 */

/**
 * Waits until selector is visible
 * 
 * @param {WaitWhileVisibleCommand} cmd
 * @return {Promise}
 */
BrowserPuppetCommands.prototype.waitWhileVisible = function (cmd) {
    var self = this;

    return Promise.try(function () {
        var pollInterval = _defaultNum(cmd.pollInterval, 500);
        var initialDelay = _defaultNum(cmd.initialDelay, 500);
        var timeout = _defaultNum(cmd.timeout, 10000);

        var isTimedOut = false;

        self._log.debug('waitWhileVisible: starting, initialDelay: ' + initialDelay);

        return Promise.delay(initialDelay)
        .then(function () {
            if (!self.isSelectorVisible(cmd.selector)) {
                self._log.debug('waitWhileVisible: selector wasnt visible: ' + cmd.selector);
                return;
            }

            setTimeout(function () {
                isTimedOut = true;
            }, timeout);

            return promiseWhile(
                function () {
                    var result = self.isSelectorVisible(cmd.selector);
                    self._log.debug('waitWhileVisible: visibility: ' + cmd.selector + ', ' + result);
                    return result;
                },
                function () {
                    if (isTimedOut) {
                        var msg = 'waitWhileVisible: timed out (time: ' + timeout + 'ms, selector: "' + cmd.selector + '")';
                        self._log.error(msg);
                        throw new Error(msg);
                    }

                    self._log.debug('waitWhileVisible: delaying');
                    return Promise.delay(pollInterval);
                }
            );
        });
    });
};

/**
 * @typedef {Command} ClickCommand
 * @property {String} type - 'click'
 * @property {String} selector
 */

/**
 * @param {ClickCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.click = function (cmd) {
    var $el = this.$(cmd.selector);
    this._assert$el($el, 'click');

    // TODO use dispatchEvent?
    $el[0].click();
};

// TODO handle meta keys, arrow keys
// TODO which event to use? keyup, keydown, keypress?

/**
 * @typedef {Command} PressKeyCommand
 * @property {String} type - 'pressKey'
 * @property {String} selector
 * @property {Number} keyCode
 */

/**
 * @param {PressKeyCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.pressKey = function (cmd) {
    var $el = this.$(cmd.selector);
    var keyCodeNum = Number(cmd.keyCode);

    assert(Number.isFinite(keyCodeNum), 'BrowserPuppetCommands::pressKey: keyCode is not a number');
    this._assert$el($el, 'pressKey');

    var keydownEvent = new KeyboardEvent('keydown', {
        which: keyCodeNum,
        keyCode: keyCodeNum,
        charCode: keyCodeNum,
    });
    $el[0].dispatchEvent(keydownEvent);
};

/**
 * @typedef {Command} SetValueCommand
 * @property {String} type - 'setValue'
 * @property {String} selector
 * @property {String} value
 */

/**
 * @param {SetValueCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.setValue = function (cmd) {
    var $el = this.$(cmd.selector);
    var el = $el[0];
    var tagName = el && el.tagName || '';

    this._assert$el($el, 'setValue');

    if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        throw new Error('Unable to set value of "' + cmd.selector + '": unsupported tag "' + tagName + '"');
    }

    $el.val(cmd.value);

    var inputEvent = new Event('input');
    el.dispatchEvent(inputEvent);
};

/**
 * @typedef {Command} FocusCommand
 * @property {String} type - 'focus'
 * @property {String} selector
 */

/**
 * @param {FocusCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.focus = function (cmd) {
    var $el = this.$(cmd.selector);
    this._assert$el($el, 'focus');
    $el[0].focus();
};

/**
 * @typedef {Command} GetValueCommand
 * @property {String} type - 'getValue'
 * @property {String} selector
 */

/**
 * @param {GetValueCommand} cmd
 * @return {String|Boolean}
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.getValue = function (cmd) {
    var $el = this.$(cmd.selector);
    var el = $el[0];

    this._assert$el($el, 'getValue');

    // TODO util fn to get node value

    // TODO handle all val() nodes
    if (el.tagName === 'INPUT' && el.type === 'checkbox') {
        return el.checked;
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        return $el.val().replace(/\n/g, '\\n');
    }

    return $el.text().replace(/\n/g, '\\n');

};

/**
 * @typedef {Command} IsVisibleCommand
 * @property {String} type - 'isVisible'
 * @property {String} selector
 */

/**
 * @param {IsVisibleCommand} cmd
 * @return {Boolean}
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.isVisible = function (cmd) {
    return this.isSelectorVisible(cmd.selector);
};

/**
 * @typedef {Command} UploadFileAndAssignCommand
 * @property {String} type - 'uploadFileAndAssign'
 * @property {Object} fileData
 * @property {String} fileData.base64 - base64 encoded file
 * @property {String} fileData.name
 * @property {String} [fileData.mime] - default: {@link DEFAULT_UPLOAD_FILE_MIME}
 * @property {String} destinationVariable - e.g. `'app.files.someFile'` assigns a `File` instance to `window.app.files.someFile` 
 */

/**
 * Upload file and assign the generated File instance to a variable.
 *
 * @param {UploadFileAndAssignCommand} cmd
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.uploadFileAndAssign = function (cmd) {
    cmd.fileData.mime = cmd.fileData.mime || DEFAULT_UPLOAD_FILE_MIME;
    lodashSet(window, cmd.destinationVariable, base64ToFile(cmd.fileData));
};

BrowserPuppetCommands.prototype._assert$el = function ($el, commandName) {
    if ($el.length === 0) {
        throw new Error(commandName + ': selector not found: "' + $el.selector + '"');
    }

    if ($el.length > 1) {
        throw new Error(commandName + ': selector not unique: "' + $el.selector + '"');
    }

    if (!this._isJQueryElementsVisible($el)) {
        throw new Error(commandName + ': selector not visible: "' + $el.selector + '"')
    }
};

function _defaultNum(value, def) {
    var numValue = Number(value);

    if (Number.isFinite(numValue)) {
        return numValue;
    }

    return def;
}
