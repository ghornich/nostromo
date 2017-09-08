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
 * @class
 * @abstract
 */
function BrowserPuppetCommands() {
    throw new Error('Can\'t create instance of abstract class "BrowserPuppetCommands"');
}

/**
 * @param {String} selector
 * @param {Number} scrollTop
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.scroll = function (selector, scrollTop) {
    var $el = this.$(selector);
    _assert$el($el, 'scroll');
    $el[0].scrollTop = scrollTop;
};

/**
 * @param {String} selector
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.mouseover = function (selector) {
    var $el = this.$(selector);
    _assert$el($el, 'mouseover');
    $el.trigger('mouseover');
};

/**
 * Waits for selector to become visible
 *
 * @param {String} selector
 * @param {Object} [options]
 * @param {Number} [options.pollInterval = 500]
 * @param {Number} [options.timeout = 10000]
 * @return {Promise}
 */
BrowserPuppetCommands.prototype.waitForVisible = function (selector, options) {
    var self = this;

    return Promise.try(function () {
        var pollInterval =  _defaultNum(options && options.pollInterval, 500);
        var timeout = _defaultNum(options && options.timeout, 10000);

        var isTimedOut = false;

        self._log.debug('waitForVisible: starting');

        if (self.isSelectorVisible(selector)) {
            self._log.debug('waitForVisible: selector wasn\'t visible: ' + selector);
            return;
        }

        setTimeout(function () {
            isTimedOut = true;
        }, timeout);

        return promiseWhile(
            function () {
                var result = self.isSelectorVisible(selector);
                self._log.debug('waitForVisible: visibility: ' + selector + ', ' + result);
                return !result;
            },
            function () {
                if (isTimedOut) {
                        var msg = 'waitForVisible: timed out (time: ' + timeout + 'ms, selector: "' + selector + '")';
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
 * Waits until selector is visible
 * 
 * @param {String} selector
 * @param {Object} [options]
 * @param {Number} [options.pollInterval = 500]
 * @param {Number} [options.initialDelay = 500]
 * @param {Number} [options.timeout = 10000]
 * @return {Promise}
 */
BrowserPuppetCommands.prototype.waitWhileVisible = function (selector, options) {
    var self = this;

    return Promise.try(function () {
        var pollInterval = _defaultNum(options && options.pollInterval, 500);
        var initialDelay = _defaultNum(options && options.initialDelay, 500);
        var timeout = _defaultNum(options && options.timeout, 10000);

        var isTimedOut = false;

        self._log.debug('waitWhileVisible: starting, initialDelay: ' + initialDelay);

        return Promise.delay(initialDelay)
        .then(function () {
            if (!self.isSelectorVisible(selector)) {
                self._log.debug('waitWhileVisible: selector wasnt visible: ' + selector);
                return;
            }

            setTimeout(function () {
                isTimedOut = true;
            }, timeout);

            return promiseWhile(
                function () {
                    var result = self.isSelectorVisible(selector);
                    self._log.debug('waitWhileVisible: visibility: ' + selector + ', ' + result);
                    return result;
                },
                function () {
                    if (isTimedOut) {
                        var msg = 'waitWhileVisible: timed out (time: ' + timeout + 'ms, selector: "' + selector + '")';
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
 * @param {String} selector
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.click = function (selector) {
    var $el = this.$(selector);
    _assert$el($el, 'click');
    // else {
        // var el = $el[0];

        // TODO detect inaccessible nodes !!!

        // if (TestToolsBase.isNodeOccluded(el)) {
        //     var occludingNode = TestToolsBase.getOccludingNode(el)
        //     console.log('OCCLUSION DETECTED - selector: ' + selector + ', occluded by: ' + occludingNode.outerHTML.substr(0,50) + ' (...)')
        //     throw new Error('Unable to click selector "'+selector+'": is occluded by other node(s)')
        // }

        // console.log('No occlusion detected for '+selector)

        // $el.trigger('click');
        $el[0].click();
    // }
};

// TODO handle meta keys, arrow keys
// TODO which event to use? keyup, keydown, keypress?

/**
 * @param {String} selector
 * @param {Number} keyCode
 * @throws {Error}
 */
BrowserPuppetCommands.prototype.pressKey = function (selector, keyCode) {
    var $el = this.$(selector);
    var keyCodeNum = Number(keyCode);

    assert(Number.isFinite(keyCodeNum), 'BrowserPuppetCommands::pressKey: keyCode is not a number');
    _assert$el($el, 'pressKey');

    // eslint-disable-next-line new-cap
    $el.trigger(this.$.Event('keydown', { which: keyCodeNum, keyCode: keyCodeNum }));
};

/**
 * @param {String} selector
 * @param {String} value
 */
BrowserPuppetCommands.prototype.setValue = function (selector, value) {
    var $el = this.$(selector);
    var el = $el[0];
    var tagName = el && el.tagName || '';

    _assert$el($el, 'setValue');

    if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        throw new Error('Unable to set value of "' + selector + '": unsupported tag "' + tagName + '"');
    }

    $el.val(value);
    $el.trigger('input');
};

/**
 * @param {String} selector
 */
BrowserPuppetCommands.prototype.focus = function (selector) {
    var $el = this.$(selector);
    _assert$el($el, 'focus');
    $el[0].focus();
};

/**
 * @param {String} selector
 * @return {String|Boolean}
 */
BrowserPuppetCommands.prototype.getValue = function (selector) {
    var $el = this.$(selector);
    var el = $el[0];

    _assert$el($el, 'getValue');

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
 * @param {String} selector
 * @return {Boolean}
 */
BrowserPuppetCommands.prototype.isVisible = function (selector) {
    return this.isSelectorVisible(selector);
};

/**
 * Upload file and assign the generated File instance to a variable.
 *
 * @param {Object} fileData
 * @param {String} fileData.base64
 * @param {String} fileData.name
 * @param {String} [fileData.mime] - default: {@link DEFAULT_UPLOAD_FILE_MIME}
 * @param {String} destinationVariable
 */
BrowserPuppetCommands.prototype.uploadFileAndAssign = function (fileData, destinationVariable) {
    fileData.mime = fileData.mime || DEFAULT_UPLOAD_FILE_MIME;
    lodashSet(window, destinationVariable, base64ToFile(fileData));
};

function _assert$el($el, commandName) {
    if ($el.length === 0) {
        throw new Error(commandName + ': selector not found: "' + $el.selector + '"');
    }

    if ($el.length > 1) {
        throw new Error(commandName + ': selector not unique: "' + $el.selector + '"');
    }
}

function _defaultNum(value, def) {
    var numValue = Number(value);

    if (Number.isFinite(numValue)) {
        return numValue;
    }

    return def;
}
