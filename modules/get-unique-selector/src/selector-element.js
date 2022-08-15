// @ts-nocheck
'use strict';

const DOMUtils = require('./dom-utils');


/**
 * Represents a single DOM node's selector, e.g.:
 *
 * .class1 .class2.red span [name="user"]
 * |-----| |---------| |--| |-----------|
 *
 *
 */

class SelectorElement {
    constructor(node, options) {
        const nodeSelectorData = SelectorElement._getNodeSelectorData(node, options);

        this._node = node;
        this._rawSelector = nodeSelectorData.selector;
        this._type = nodeSelectorData.type;
        this._active = true;
        this._useNthChild = false;
        this._nthChild = Array.prototype.indexOf.call(node.parentNode.children, node) + 1;
    }

    get node() {
        return this._node;
    }

    get rawSelector() {
        if (!this._active) {
            return null;
        }

        return this._rawSelector;
    }

    set rawSelector(val) {
        // TODO enforce selector type?
        this._rawSelector = val;
    }

    get selector() {
        if (!this._active) {
            return null;
        }

        return this._rawSelector + (this._useNthChild ? ':nth-child(' + this._nthChild + ')' : '');
    }

    get type() {
        return this._type;
    }

    get active() {
        return this._active;
    }

    set active(val) {
        if (typeof val !== 'boolean') {
            throw new Error('Invalid type for "active"');
        }

        this._active = val;
    }

    get useNthChild() {
        return this._useNthChild;
    }
    set useNthChild(val) {
        if (typeof val !== 'boolean') {
            throw new Error('Invalid type for "useNthChild"');
        }

        this._useNthChild = val;
    }

    /**
     * [getSelectorStringData description]
     * @param  {Object} node [description]
     * @return {Object} { selector: String, type: Number }
     */
    static _getNodeSelectorData(node, rawOptions) {
        if (!node || !('tagName' in node)) {
            const error = new Error('SelectorElement::_getNodeSelectorData: invalid node');
            error.type = SelectorElement.ERROR.INVALID_NODE;
            throw error;
        }

        const options = rawOptions || {};
        options.ignoredClasses = options.ignoredClasses || [];

        if (options.useIds && DOMUtils.hasId(node)) {
            return {
                selector: '#' + DOMUtils.getId(node),
                type: SelectorElement.TYPE.ID,
            };
        }

        if (DOMUtils.hasClass(node)) {
            let classNames = DOMUtils.getClass(node);

            options.ignoredClasses.forEach(function (ignoredClass) {
                const replaceRegex = new RegExp('(^|\\s+)' + ignoredClass + '($|\\s+)', 'i');

                classNames = classNames.replace(replaceRegex, ' ');
            });

            if (options.preferredClass && options.preferredClass.test(classNames)) {
                const regex = new RegExp(options.preferredClass.source, 'g');
                let match;
                const matches = [];

                // eslint-disable-next-line no-cond-assign
                while (match = regex.exec(classNames)) {
                    matches.push(match[0]);
                }

                classNames = matches.join(' ');
            }

            classNames = classNames.trim();

            if (classNames.length > 0) {
                return {
                    selector: '.' + classNames.replace(/ +/g, '.'),
                    type: SelectorElement.TYPE.CLASS,
                };
            }
        }

        const maybeNameAttr = (node.getAttribute('name') || '').trim();

        if (maybeNameAttr.length > 0) {
            return {
                selector: node.tagName.toLowerCase() + '[name="' + maybeNameAttr + '"]',
                type: SelectorElement.TYPE.ATTR,
            };
        }

        return {
            selector: node.tagName.toLowerCase(),
            type: SelectorElement.TYPE.TAG,
        };
    }
}

SelectorElement.TYPE = {
    ID: 0,
    CLASS: 1,
    ATTR: 2,
    TAG: 3,
};

SelectorElement.ERROR = {
    INVALID_NODE: 0,
};

module.exports = SelectorElement;
