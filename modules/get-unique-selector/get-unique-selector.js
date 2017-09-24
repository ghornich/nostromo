'use strict';

var defaults = require('lodash.defaults');
var DOMUtils = require('./dom-utils');
var SelectorElement = require('./selector-element');
var SelectorElementList = require('./selector-element-list');

exports = module.exports = UniqueSelector;

/**
 * @typedef {Object} GetUniqueSelectorOptions
 * @property {Function} [querySelectorAll]
 * @property {Array<String>} [ignoredClasses] - ignored class names (without leading '.')
 * @property {Boolean} [useIds = true]
 * @property {RegExp} [preferredClass] - e.g. /test--[^ ]+/
 * @property {Boolean} [useClosestParentWithPreferredClass = false]
 * @property {Number} [preferredClassParentLimit = 0]
 */

/**
 * @param {GetUniqueSelectorOptions} options
 */
function UniqueSelector(options) {
    this._opts = defaults({}, options, {
        querySelectorAll: document.querySelectorAll.bind(document),
        ignoredClasses: [],
        useIds: true,
        // regex
        preferredClass: null,
        useClosestParentWithPreferredClass: false,
        preferredClassParentLimit: 0,
    });
}

UniqueSelector.prototype.get = function (node) {
    var _node = node;

    if (this._opts.useIds && DOMUtils.hasId(_node)) {
        return '#' + DOMUtils.getId(_node);
    }

    // traverse up until prefClass is found or max depth reached or body reached
    if (this._opts.preferredClass && this._opts.useClosestParentWithPreferredClass) {
        var currentNode = _node
        var depth = 0;
        var depthLimit = 1000;

        while (currentNode && currentNode.tagName !== 'BODY') {
            if (depth >= this._opts.preferredClassParentLimit) {
                break;
            }

            if (depth >= depthLimit) {
                throw new Error('Infinite loop error');
            }

            if (this._opts.preferredClass.test(currentNode.className)) {
                _node = currentNode
                break
            }

            currentNode = currentNode.parentNode
            depth++;
        }
    }

    var selectorElementList = this._getFullSelectorElementList(_node);

    selectorElementList.simplify();

    if (!selectorElementList.isUnique()) {
        selectorElementList.uniqueify();
    }

    selectorElementList.simplifyClasses();

    return selectorElementList.getSelectorPath();
};

UniqueSelector.prototype._getFullSelectorElementList = function (node) {
    var selectorElementList = new SelectorElementList({
        querySelectorAll: this._opts.querySelectorAll,
    });

    var currentNode = node;

    while (currentNode && currentNode.tagName !== 'BODY') {
        var selectorElement = new SelectorElement(currentNode, this._opts);

        selectorElementList.addElement(selectorElement);

        // if (selectorElement.type === SelectorElement.TYPE.ID) {
        //     break;
        // }

        currentNode = currentNode.parentNode;
    }

    return selectorElementList;
};

UniqueSelector.prototype.getFullSelectorPath = function (node) {
    return this._getFullSelectorElementList(node).getSelectorPath();
};
