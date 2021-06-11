'use strict';
const DOMUtils = require('./dom-utils');
const SelectorElement = require('./selector-element');
const SelectorElementList = require('./selector-element-list');
exports = module.exports = UniqueSelector;
/**
 * @typedef {Object} UniqueSelectorOptions
 * @property {Function} [querySelectorAll]
 * @property {Array<String>} [ignoredClasses] - ignored class names (without leading '.')
 * @property {Boolean} [useIds = true]
 * @property {RegExp} [preferredClass] - e.g. /test--[^ ]+/
 * @property {Boolean} [useClosestParentWithPreferredClass = false]
 * @property {Number} [preferredClassParentLimit = 0]
 */
/**
 * @param {UniqueSelectorOptions} options
 */
function UniqueSelector(options) {
    // TODO test all options
    this._opts = Object.assign({}, {
        // @ts-expect-error
        querySelectorAll: document.querySelectorAll.bind(document),
        ignoredClasses: [],
        useIds: true,
        // regex
        preferredClass: null,
        useClosestParentWithPreferredClass: false,
        preferredClassParentLimit: 0,
    }, options);
    if (this._opts.preferredClass && this._opts.preferredClass.global) {
        throw new Error('Global flag not allowed for "preferredClass"');
    }
}
UniqueSelector.prototype.get = function (node) {
    let _node = node;
    if (this._opts.useIds && DOMUtils.hasId(_node)) {
        return '#' + DOMUtils.getId(_node);
    }
    // traverse up until prefClass is found or max depth reached or body reached
    if (this._opts.preferredClass && this._opts.useClosestParentWithPreferredClass) {
        let currentNode = _node;
        let depth = 0;
        const depthLimit = 1000;
        while (currentNode && currentNode.tagName !== 'BODY') {
            if (depth >= this._opts.preferredClassParentLimit) {
                break;
            }
            if (depth >= depthLimit) {
                throw new Error('Infinite loop error');
            }
            if (this._opts.preferredClass.test(currentNode.className)) {
                _node = currentNode;
                break;
            }
            currentNode = currentNode.parentNode;
            depth++;
        }
    }
    const selectorElementList = this._getParentSelectorPath(_node);
    selectorElementList.simplify();
    if (!selectorElementList.isUnique()) {
        selectorElementList.uniqueify();
    }
    selectorElementList.simplifyClasses(false);
    if (this._opts.preferredClass) {
        // run simplify alg again, remove unnecessary preferred classes
        selectorElementList.simplify(false);
    }
    return selectorElementList.getSelectorPath();
};
UniqueSelector.prototype._getParentSelectorPath = function (node) {
    const selectorElementList = new SelectorElementList(this._opts);
    let currentNode = node;
    while (currentNode && currentNode.tagName !== 'BODY') {
        const selectorElement = new SelectorElement(currentNode, this._opts);
        selectorElementList.addElement(selectorElement);
        if (this._opts.useIds && selectorElement.type === SelectorElement.TYPE.ID) {
            break;
        }
        currentNode = currentNode.parentNode;
    }
    return selectorElementList;
};
UniqueSelector.prototype.getFullSelectorPath = function (node) {
    return this._getParentSelectorPath(node).getSelectorPath();
};
