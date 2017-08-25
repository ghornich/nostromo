'use strict';

exports = module.exports = SelectorElementList;

function SelectorElementList(options) {
	this._opts = optionDefaults(options, {
		querySelectorAll: document.querySelectorAll.bind(document)
	})

	this._selectorElements = []

	Object.seal(this)
}

SelectorElementList.prototype.getSelectorPath = function () {
	return this._selectorElements
		.map(function (selectorElement) {
			return selectorElement.selector
		})
		.filter(function (selector) { return Boolean(selector) })
		.join(' ')
		.trim()
		.replace(/ +/g, ' ');
}

SelectorElementList.prototype.addElement = function (element) {
	this._selectorElements.unshift(element)
}

SelectorElementList.prototype.getAmbiguity = function () {
	return this._opts.querySelectorAll(this.getSelectorPath()).length
}

SelectorElementList.prototype.isUnique = function () {
	return this.getAmbiguity() === 1;
}

SelectorElementList.prototype.simplify = function () {
	var ambiguity = this.getAmbiguity()

	for (var i = 0, len = this._selectorElements.length; i < len - 1; i++) {
		var selectorElement = this._selectorElements[i]

		if (!selectorElement.active) {
			continue
		}

		selectorElement.active = false

		var newAmbiguity = this.getAmbiguity()

		if (ambiguity !== newAmbiguity) {
			selectorElement.active = true
		}



	}
}

// TODO if selectorElement is type CLASS and >1 classnames: simplify classnames

SelectorElementList.prototype.simplifyClasses = function () {
	var ambiguity = this.getAmbiguity()

	for (var i = 0, len = this._selectorElements.length; i < len - 1; i++) {
		var selectorElement = this._selectorElements[i]

		if (!selectorElement.active || selectorElement.type !== SelectorElement.TYPE.CLASS) {
			return
		}

		// 	var originalSelector = selectorElement.rawSelector
		// 	var classNames = originalSelector.split(/(?=\.)/g)
		// 	var ignoredClassIdxs = []
		
		// 	if (classNames.length > 1) {
		// 		for (var classIdx = 0, classLen = classNames.length; classIdx < classLen; classIdx++) {
		// 			var className = classNames[classIdx]

					
		// 		}
		// 	}
	}

}

/**
 * add "nth-child"s from back until selector becomes unique
 */
SelectorElementList.prototype.uniqueify = function () {
	var ambiguity = this.getAmbiguity()

	for (var i = this._selectorElements.length - 1; i >= 0; i--) {
		var selectorElement = this._selectorElements[i]
		var prevActiveValue = selectorElement.active

		selectorElement.active = true
		selectorElement.useNthChild = true

		var newAmbiguity = this.getAmbiguity()

		// TODO error check: newAmbiguity < 1

		if (newAmbiguity < ambiguity) {
			ambiguity = newAmbiguity

			if (ambiguity === 1) {
				break
			}
		}
		else {
			selectorElement.useNthChild = false
			selectorElement.active = prevActiveValue
		}
	}
}