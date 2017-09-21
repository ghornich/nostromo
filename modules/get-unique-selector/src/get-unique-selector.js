'use strict';

var DOMUtils = require('./dom-utils');
var SelectorElement = require('./selector-element');
var SelectorElementList = require('./selector-element-list');

exports = module.exports = UniqueSelector;

function UniqueSelector(options) {
    this._opts = Object.assign({}, {
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

    var selectorElementList = this._getParentSelectorPath(_node);

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
    var selectorElementList = new SelectorElementList(this._opts);

    var currentNode = node;

    while (currentNode && currentNode.tagName !== 'BODY') {
        var selectorElement = new SelectorElement(currentNode, this._opts);

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
