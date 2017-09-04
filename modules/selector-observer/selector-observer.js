'use strict';

var assert = require('assert');

exports = module.exports = SelectorObserver;

/**
 * @param {Object} conf
 * @param {String} conf.selector
 * @param {String} conf.onSelectorBecameVisible
 */
function SelectorObserver(conf) {
    assert(typeof conf === 'object', 'conf is not an object');

    this._conf = conf;

    if ('MutationObserver' in window) {
        var mo = new MutationObserver(this._onMutation.bind(this));
        mo.observe(document.body, { childList: true, subtree: true, attributeFilter: ['style', 'class'] });
    }
    else {
        // TODO implement polling?
        throw new Error('MutationObserver not supported');
    }
}

SelectorObserver.prototype._onMutation = function (me) {

};
