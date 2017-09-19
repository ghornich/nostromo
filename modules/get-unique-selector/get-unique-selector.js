'use strict';

var defaults = require('lodash.defaults');
var DOMUtils = require('./dom-utils');
var SelectorElement = require('./selector-element');
var SelectorElementList = require('./selector-element-list');

exports = module.exports = UniqueSelector;

function UniqueSelector(options) {
    this._opts = defaults({}, options, {
        querySelectorAll: document.querySelectorAll.bind(document),
        ignoredClasses: [],
        // regex
        preferredClass: /test--[^ ]+/, // TODO remove hardcoded value
        preferredClassParentLimit: 3, // TODO remove hardcoded value
    });
}

// UniqueSelector.prototype.getWithPreferredClass = function (node) {
//     var preferredClass = this._opts.preferredClass;

//     if (!preferredClass) {
//         return null;
//     }

//     var currentNode = node;
//     var prefClassList = [];
//     var preferredClassFound = false;
//     var preferredClassParentNumber = 0;

//     while (currentNode && currentNode.tagName !== 'BODY') {
//         if (preferredClass.test(currentNode.className)) {
//             preferredClassFound = true;
//             prefClassList.unshift(currentNode.className.match(preferredClass)[0]);
//         }
//         else {
//             if (!preferredClassFound) {
//                 preferredClassParentNumber++;
//             }
//         }

//         if (preferredClassParentNumber > this._opts.preferredClassParentLimit) {
//             return null;
//         }

//         currentNode = currentNode.parentNode;
//     }



//     function getSelectorFromPrefClassList(){
//         return '.' + prefClassList.join(' .')
//     }

//     ........
// };

UniqueSelector.prototype.get = function (node) {
    var _node = node;

    // var maybeSelectorWithPreferredClass = this.getWithPreferredClass(_node);

    // if (maybeSelectorWithPreferredClass) {
    //     return maybeSelectorWithPreferredClass;
    // }

    // if (DOMUtils.hasId(_node)) {
    //     return '#' + DOMUtils.getId(_node);
    // }

    // traverse up until prefClass is found or max depth reached or body reached
    if (this._opts.preferredClass) {
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
