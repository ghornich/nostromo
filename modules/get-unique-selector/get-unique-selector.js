'use strict';

var defaults = require('lodash.defaults');
var DOMUtils = require('./dom-utils');
var SelectorElement = require('./selector-element')
var SelectorElementList=require('./selector-element-list')

exports = module.exports = UniqueSelector

function UniqueSelector(options) {
	this._opts = defaults({}, options, {
		querySelectorAll: document.querySelectorAll.bind(document),
		ignoredClasses: []
	})
}

UniqueSelector.prototype.get = function(node) {
	if (DOMUtils.hasId(node)) {
		return '#' + DOMUtils.getId(node)
	}

	var selectorElementList = this._getFullSelectorElementList(node);

	selectorElementList.simplify()

	if (!selectorElementList.isUnique()) {
		selectorElementList.uniqueify()
	}

	return selectorElementList.getSelectorPath()
}

UniqueSelector.prototype._getFullSelectorElementList = function (node) {
	var selectorElementList = new SelectorElementList({
		querySelectorAll: this._opts.querySelectorAll
	})

	var currentNode = node

	while (currentNode && currentNode.tagName !== 'BODY') {
		var selectorElement = new SelectorElement(currentNode, this._opts)

		selectorElementList.addElement(selectorElement);

		if (selectorElement.type === SelectorElement.TYPE.ID) {
			break
		}

		currentNode = currentNode.parentNode
	}

	return selectorElementList;
}

UniqueSelector.prototype.getFullSelectorPath = function (node) {
	return this._getFullSelectorElementList(node).getSelectorPath()
}
