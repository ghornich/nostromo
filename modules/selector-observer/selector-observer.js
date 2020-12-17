// @ts-nocheck

'use strict';

var assert = require('assert');
var $ = require('jquery'); $.noConflict();

exports = module.exports = SelectorObserver;

/**
 * @param {Object} conf
 * @param {String} conf.observeList
 */
function SelectorObserver(conf) {
    assert('MutationObserver' in window, 'MutationObserver not supported');

    assert(typeof conf === 'object', 'conf is not an object');
    assert(__isArray(conf.observeList), 'conf.observeList is not an array');
    // TODO observeList.selector's must be unique

    this._conf = conf;

    this._selectorPrevVisible = this._conf.observeList.map(function () {
        return null;
    });

    // first run: determine starting states of observed selectors
    this._onMutation();

    this._mutationObserver = new window.MutationObserver(this._onMutation.bind(this));
    this._mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
}

SelectorObserver.prototype._onMutation = function () {
    var self = this;

    self._conf.observeList.forEach(function (item, i) {
        var prevIsVisible = self._selectorPrevVisible[i];
        var isVisible = $(item.selector).is(':visible');

        // console.log('[SelectorObserver] '+item.selector+(isVisible?' visible':' not visible'))

        try {
            if (prevIsVisible !== null && !prevIsVisible && isVisible) {
                item.listener();
            }
        }
        catch (error) {
            console.error(error);
        }

        self._selectorPrevVisible[i] = isVisible;
    });
};

SelectorObserver.prototype.disconnect = function () {
    this._mutationObserver.disconnect();
};

function __isArray(val) {
    return Object.prototype.toString.call(val) === '[object Array]';
}
