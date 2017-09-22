'use strict';

var defaults = require('lodash.defaults');
var SelectorElement = require('./selector-element');

exports = module.exports = SelectorElementList;

function SelectorElementList(options) {
    this._opts = defaults({}, options, {
        querySelectorAll: document.querySelectorAll.bind(document),
    });

    this._selectorElements = [];

    Object.seal(this);
}

SelectorElementList.prototype.getSelectorPath = function () {
    return this._selectorElements
    .map(function (selectorElement) {
        return (selectorElement.selector || '');
    })
    .join('>')
    .replace(/>{2,}/g, ' ')
    .replace(/^>|>$/, '')
    .replace(/>/g, ' > ')
    .trim()
};

SelectorElementList.prototype.toString = SelectorElementList.prototype.getSelectorPath;

SelectorElementList.prototype.addElement = function (element) {
    this._selectorElements.unshift(element);
};

SelectorElementList.prototype.getAmbiguity = function () {
    return this._opts.querySelectorAll(this.getSelectorPath()).length;
};

SelectorElementList.prototype.isUnique = function () {
    return this.getAmbiguity() === 1;
};

SelectorElementList.prototype.simplify = function (enableUsePreferredClass) {
    var ambiguity = this.getAmbiguity();
    enableUsePreferredClass = enableUsePreferredClass === undefined ? true : enableUsePreferredClass;

    for (var i = 0, len = this._selectorElements.length; i < len - 1; i++) {
        var selectorElement = this._selectorElements[i];
        var isTypeOfClass = selectorElement.type === SelectorElement.TYPE.CLASS;

        if (!selectorElement.active) {
            continue;
        }

        if (enableUsePreferredClass && this._opts.preferredClass && isTypeOfClass && this._opts.preferredClass.test(selectorElement.selector)) {
            continue;
        }

        selectorElement.active = false;

        var newAmbiguity = this.getAmbiguity();

        if (ambiguity !== newAmbiguity) {
            selectorElement.active = true;
        }
    }
};

SelectorElementList.prototype.simplifyClasses = function (enableUsePreferredClass) {
    enableUsePreferredClass = enableUsePreferredClass === undefined ? true : enableUsePreferredClass;

    for (var selectorElementIdx = 0, len = this._selectorElements.length; selectorElementIdx < len; selectorElementIdx++) {
        var selectorElement = this._selectorElements[selectorElementIdx];

        if (!selectorElement.active || selectorElement.type !== SelectorElement.TYPE.CLASS) {
            continue;
        }

        var originalSelector = selectorElement.rawSelector
        var classList = new ClassList(originalSelector)

        if (classList.length > 1) {
            for (var classIdx = classList.length - 1; classIdx >= 0; classIdx--) {
                var classListElement = classList.get(classIdx)

                if (enableUsePreferredClass && this._opts.preferredClass && this._opts.preferredClass.test(classListElement.className)) {
                    continue;
                }

                classListElement.enabled = false
                selectorElement.rawSelector = classList.getSelector()

                if (selectorElement.rawSelector === '' || this.getAmbiguity() > 1) {
                    classListElement.enabled = true
                }
            }

            selectorElement.rawSelector = classList.getSelector()
        }
    }

};

function ClassList(classSelector){
    this.classListElements = classSelector.split(/(?=\.)/g).map(function (className) {
        return new ClassListElement(className)
    })

    Object.defineProperty(this, 'length', {
        get: function () {return this.classListElements.length}
    })
}

ClassList.prototype.get=function(i){
    return this.classListElements[i]
}

ClassList.prototype.getSelector=function(){
    return this.classListElements.map(function (cle){
        return cle.enabled
            ? cle.className
            : null
    })
    .filter(function(s){return s})
    .join('')
}

function ClassListElement(className) {
    this.enabled = true;
    this.className=className;
}

/**
 * add "nth-child"s from back until selector becomes unique
 */
SelectorElementList.prototype.uniqueify = function () {
    var ambiguity = this.getAmbiguity();

    for (var i = this._selectorElements.length - 1; i >= 0; i--) {
        var selectorElement = this._selectorElements[i];
        var prevActiveValue = selectorElement.active;

        selectorElement.active = true;
        selectorElement.useNthChild = true;

        var newAmbiguity = this.getAmbiguity();

        // TODO error check: newAmbiguity < 1

        if (newAmbiguity < ambiguity) {
            ambiguity = newAmbiguity;

            if (ambiguity === 1) {
                break;
            }
        }
        else {
            selectorElement.useNthChild = false;
            selectorElement.active = prevActiveValue;
        }
    }
};
