'use strict';

var DOMUtils = require('./dom-utils');

exports =module.exports=SelectorElement

SelectorElement.TYPE = {
	ID: 0,
	CLASS: 1,
	ATTR: 2,
	TAG: 3
}

SelectorElement.ERROR = {
	INVALID_NODE: 0
}

/**
 * Represents a single DOM node's selector, e.g.:
 *
 * .class1 .class2.red span [name="user"]
 * |-----| |---------| |--| |-----------|
 *
 * 
 */

function SelectorElement(node, options) {
	var nodeSelectorData = SelectorElement._getNodeSelectorData(node, options)

	this._node = node
	this._rawSelector = nodeSelectorData.selector,
	this._type = nodeSelectorData.type,
	this._active = true,
	this._useNthChild = false,
	this._nthChild = Array.prototype.indexOf.call(node.parentNode.children, node) + 1

	Object.defineProperties(this, {
		node: {
			get: function () {
				return this._node
			},
			set: function () {
				throw new Error('Cannot set read-only property "node"')
			}
		},
		rawSelector: {
			get: function () {
				if (!this._active) {
					return null
				}

				return this._rawSelector
			},
			set: function (val) {
				// TODO enforce selector type?
				this._rawSelector = val
			}
		},
		selector: {
			get: function () {
				if (!this._active) {
					return null
				}

				return this._rawSelector + (this._useNthChild ? ':nth-child(' + this._nthChild + ')' : '')
			},
			set: function () {
				throw new Error('Cannot set read-only property "selector"')
			}
		},
		type: {
			get: function () {
				return this._type
			},
			set: function () {
				throw new Error('Cannot set read-only property "type"')
			}
		},
		active: {
			get: function () {
				return this._active
			},
			set: function (val) {
				if (typeof val !== 'boolean') {
					throw new Error('Invalid type for "active"')
				}

				this._active = val
			}
		},
		useNthChild: {
			get: function () {
				return this._useNthChild
			},
			set: function (val) {
				if (typeof val !== 'boolean') {
					throw new Error('Invalid type for "useNthChild"')
				}

				this._useNthChild = val
			}
		},
	})

	Object.seal(this)
}


/**
 * [getSelectorStringData description]
 * @param  {[type]} node [description]
 * @return {Object} { selector: String, type: Number }
 */
SelectorElement._getNodeSelectorData = function (node, options) {
	if (!node || !('tagName' in node)) {
		var error = new Error('SelectorElement::_getNodeSelectorData: invalid node');
		error.type = SelectorElement.ERROR.INVALID_NODE
		throw error
	}

	options.ignoredClasses = options.ignoredClasses||[]

	if (DOMUtils.hasId(node)) {
		return {
			selector: '#' + DOMUtils.getId(node),
			type: SelectorElement.TYPE.ID
		}
	}

	if (DOMUtils.hasClass(node)) {
		var classNames = DOMUtils.getClass(node)

		options.ignoredClasses.forEach(function(ignoredClass) {
			classNames = classNames.replace(ignoredClass, '')
		})

		classNames = classNames.trim()

		if (classNames.length > 0) {
			return {
				selector: '.' + classNames.replace(/ +/g, '.'),
				type: SelectorElement.TYPE.CLASS
			}	
		}
	}

	var maybeNameAttr = (node.getAttribute('name') || '').trim(); 

	if (maybeNameAttr.length > 0) {
		return {
			selector: node.tagName.toLowerCase() + '[name="' + maybeNameAttr + '"]',
			type: SelectorElement.TYPE.ATTR
		}
	}

	return {
		selector: node.tagName.toLowerCase(),
		type: SelectorElement.TYPE.TAG
	}
}