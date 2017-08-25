(function () {
	'use strict';

	// TODO preferred selectors?

	var NodeUtils = {}

	UniqueSelector._SelectorElement = SelectorElement
	UniqueSelector._SelectorElementList = SelectorElementList
	UniqueSelector._NodeUtils = NodeUtils

	// -----------------------

	if (typeof module === 'object' && typeof module.exports === 'object' && typeof exports === 'object') {
		exports = module.exports = UniqueSelector
	}
	else {
		window.UniqueSelector = UniqueSelector
	}

	// -----------------------

	function SelectorElement(node, options) {
		var nodeSelectorData = SelectorElement.getNodeSelectorData(node, options)

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
			// TODO unit test
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
			// nthChild: {
			//  get: function () { return this._nthChild },
			//  set: function () { throw new Error('Cannot set read-only property "nthChild"') }
			// }
		})

		Object.seal(this)
	}

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
	 * [getSelectorStringData description]
	 * @param  {[type]} node [description]
	 * @return {Object} { selector: String, type: Number }
	 */
	SelectorElement.getNodeSelectorData = function (node, options) {
		if (!node || !('tagName' in node)) {
			var error = new Error('SelectorElement::getNodeSelectorData: invalid node');
			error.type = SelectorElement.ERROR.INVALID_NODE
			throw error
		}

		options.ignoredClasses = options.ignoredClasses||[]

		if (NodeUtils.hasId(node)) {
			return {
				selector: '#' + NodeUtils.getId(node),
				type: SelectorElement.TYPE.ID
			}
		}

		if (NodeUtils.hasClass(node)) {
			var classNames = NodeUtils.getClass(node)

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

		// TODO custom attributes?

		var maybeNameAttr = (node.getAttribute('name') || '').trim(); 

		if (maybeNameAttr.length > 0) {
			return {
				selector: node.tagName.toLowerCase() + '[name="' + maybeNameAttr + '"]',
				type: SelectorElement.TYPE.ATTR
			}
		}

		// TODO other common selectors?

		return {
			selector: node.tagName.toLowerCase(),
			type: SelectorElement.TYPE.TAG
		}
	}

	// -----------------------

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

	// -----------------------

	function UniqueSelector(options) {
		this._opts = optionDefaults(options, {
			querySelectorAll: document.querySelectorAll.bind(document),
			ignoredClasses: []
		})
	}

	UniqueSelector.prototype.get = function(node) {
		if (NodeUtils.hasId(node)) {
			return '#' + NodeUtils.getId(node)
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

	// -----------------------

	NodeUtils.hasId = function (node) {
		return Boolean(node && typeof node.id === 'string' && node.id.trim().length > 0)
	}

	NodeUtils.getId = function (node) {
		return node.id.trim()
	}

	NodeUtils.hasClass = function (node) {
		return Boolean(node && typeof node.className === 'string' && node.className.trim().length > 0)
	}

	NodeUtils.getClass = function (node) {
		return node.className.trim()
	}

	// -----------------------

	function optionDefaults(options, defaults) {
		if (!options) {
			return defaults
		}

		Object.keys(defaults).forEach(function (key) {
			if (!(key in options)) {
				options[key] = defaults[key]
			}
		})

		return options
	}
})()
