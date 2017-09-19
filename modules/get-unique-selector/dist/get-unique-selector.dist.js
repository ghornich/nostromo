(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

window.GetUniqueSelector = require('../');

},{"../":3}],2:[function(require,module,exports){
'use strict';

var DOMUtils = exports;

DOMUtils.hasId = function (node) {
    return Boolean(node && typeof node.id === 'string' && node.id.trim().length > 0);
};

DOMUtils.getId = function (node) {
    return node.id.trim();
};

DOMUtils.hasClass = function (node) {
    return Boolean(node && typeof node.className === 'string' && node.className.trim().length > 0);
};

DOMUtils.getClass = function (node) {
    return node.className.trim();
};

},{}],3:[function(require,module,exports){
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

},{"./dom-utils":2,"./selector-element":5,"./selector-element-list":4,"lodash.defaults":6}],4:[function(require,module,exports){
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
        return selectorElement.selector;
    })
    .filter(function (selector) {
        return Boolean(selector);
    })
    .join(' ')
    .trim()
    .replace(/ +/g, ' ');
};

SelectorElementList.prototype.addElement = function (element) {
    this._selectorElements.unshift(element);
};

SelectorElementList.prototype.getAmbiguity = function () {
    return this._opts.querySelectorAll(this.getSelectorPath()).length;
};

SelectorElementList.prototype.isUnique = function () {
    return this.getAmbiguity() === 1;
};

SelectorElementList.prototype.simplify = function () {
    var ambiguity = this.getAmbiguity();

    for (var i = 0, len = this._selectorElements.length; i < len - 1; i++) {
        var selectorElement = this._selectorElements[i];

        if (!selectorElement.active) {
            continue;
        }

        selectorElement.active = false;

        var newAmbiguity = this.getAmbiguity();

        if (ambiguity !== newAmbiguity) {
            selectorElement.active = true;
        }
    }
};

SelectorElementList.prototype.simplifyClasses = function () {
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

},{"./selector-element":5,"lodash.defaults":6}],5:[function(require,module,exports){
'use strict';

var DOMUtils = require('./dom-utils');

exports = module.exports = SelectorElement;

SelectorElement.TYPE = {
    ID: 0,
    CLASS: 1,
    ATTR: 2,
    TAG: 3,
};

SelectorElement.ERROR = {
    INVALID_NODE: 0,
};

/**
 * Represents a single DOM node's selector, e.g.:
 *
 * .class1 .class2.red span [name="user"]
 * |-----| |---------| |--| |-----------|
 *
 * 
 */

function SelectorElement(node, options) {
    var nodeSelectorData = SelectorElement._getNodeSelectorData(node, options);

    this._node = node;
    this._rawSelector = nodeSelectorData.selector;
    this._type = nodeSelectorData.type;
    this._active = true;
    this._useNthChild = false;
    this._nthChild = Array.prototype.indexOf.call(node.parentNode.children, node) + 1;

    Object.defineProperties(this, {
        node: {
            get: function () {
                return this._node;
            },
            set: function () {
                throw new Error('Cannot set read-only property "node"');
            },
        },
        rawSelector: {
            get: function () {
                if (!this._active) {
                    return null;
                }

                return this._rawSelector;
            },
            set: function (val) {
                // TODO enforce selector type?
                this._rawSelector = val;
            },
        },
        selector: {
            get: function () {
                if (!this._active) {
                    return null;
                }

                return this._rawSelector + (this._useNthChild ? ':nth-child(' + this._nthChild + ')' : '');
            },
            set: function () {
                throw new Error('Cannot set read-only property "selector"');
            },
        },
        type: {
            get: function () {
                return this._type;
            },
            set: function () {
                throw new Error('Cannot set read-only property "type"');
            },
        },
        active: {
            get: function () {
                return this._active;
            },
            set: function (val) {
                if (typeof val !== 'boolean') {
                    throw new Error('Invalid type for "active"');
                }

                this._active = val;
            },
        },
        useNthChild: {
            get: function () {
                return this._useNthChild;
            },
            set: function (val) {
                if (typeof val !== 'boolean') {
                    throw new Error('Invalid type for "useNthChild"');
                }

                this._useNthChild = val;
            },
        },
    });

    Object.seal(this);
}


/**
 * [getSelectorStringData description]
 * @param  {[type]} node [description]
 * @return {Object} { selector: String, type: Number }
 */
SelectorElement._getNodeSelectorData = function (node, rawOptions) {
    if (!node || !('tagName' in node)) {
        var error = new Error('SelectorElement::_getNodeSelectorData: invalid node');
        error.type = SelectorElement.ERROR.INVALID_NODE;
        throw error;
    }

    var options = rawOptions || {};
    options.ignoredClasses = options.ignoredClasses || [];

    if (options.useIds && DOMUtils.hasId(node)) {
        return {
            selector: '#' + DOMUtils.getId(node),
            type: SelectorElement.TYPE.ID,
        };
    }

    if (DOMUtils.hasClass(node)) {
        var classNames = DOMUtils.getClass(node);

        options.ignoredClasses.forEach(function (ignoredClass) {
            classNames = classNames.replace(ignoredClass, '');
        });

        if (options.preferredClass && options.preferredClass.test(classNames)) {
            classNames = classNames.match(options.preferredClass)[0];
        }

        classNames = classNames.trim();

        if (classNames.length > 0) {
            return {
                selector: '.' + classNames.replace(/ +/g, '.'),
                type: SelectorElement.TYPE.CLASS,
            };
        }
    }

    var maybeNameAttr = (node.getAttribute('name') || '').trim();

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
};

},{"./dom-utils":2}],6:[function(require,module,exports){
/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  switch (args.length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates an array of the enumerable property names of the array-like `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @param {boolean} inherited Specify returning inherited property names.
 * @returns {Array} Returns the array of property names.
 */
function arrayLikeKeys(value, inherited) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  // Safari 9 makes `arguments.length` enumerable in strict mode.
  var result = (isArray(value) || isArguments(value))
    ? baseTimes(value.length, String)
    : [];

  var length = result.length,
      skipIndexes = !!length;

  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Used by `_.defaults` to customize its `_.assignIn` use.
 *
 * @private
 * @param {*} objValue The destination value.
 * @param {*} srcValue The source value.
 * @param {string} key The key of the property to assign.
 * @param {Object} object The parent object of `objValue`.
 * @returns {*} Returns the value to assign.
 */
function assignInDefaults(objValue, srcValue, key, object) {
  if (objValue === undefined ||
      (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) {
    return srcValue;
  }
  return objValue;
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq(objValue, value)) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  if (!isObject(object)) {
    return nativeKeysIn(object);
  }
  var isProto = isPrototype(object),
      result = [];

  for (var key in object) {
    if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

/**
 * The base implementation of `_.rest` which doesn't validate or coerce arguments.
 *
 * @private
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 */
function baseRest(func, start) {
  start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    index = -1;
    var otherArgs = Array(start + 1);
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property identifiers to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : undefined;

    assignValue(object, key, newValue === undefined ? source[key] : newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return baseRest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = (assigner.length > 3 && typeof customizer == 'function')
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  length = length == null ? MAX_SAFE_INTEGER : length;
  return !!length &&
    (typeof value == 'number' || reIsUint.test(value)) &&
    (value > -1 && value % 1 == 0 && value < length);
}

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
 *  else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
        ? (isArrayLike(object) && isIndex(index, object.length))
        : (type == 'string' && index in object)
      ) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * This function is like
 * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
 * except that it includes inherited enumerable properties.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function nativeKeysIn(object) {
  var result = [];
  if (object != null) {
    for (var key in Object(object)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Performs a
 * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'a': 1 };
 * var other = { 'a': 1 };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an `arguments` object,
 *  else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null && isLength(value.length) && !isFunction(value);
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object,
 *  else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a function, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8-9 which returns 'object' for typed array and other constructors.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This method is loosely based on
 * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * This method is like `_.assignIn` except that it accepts `customizer`
 * which is invoked to produce the assigned values. If `customizer` returns
 * `undefined`, assignment is handled by the method instead. The `customizer`
 * is invoked with five arguments: (objValue, srcValue, key, object, source).
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @alias extendWith
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} sources The source objects.
 * @param {Function} [customizer] The function to customize assigned values.
 * @returns {Object} Returns `object`.
 * @see _.assignWith
 * @example
 *
 * function customizer(objValue, srcValue) {
 *   return _.isUndefined(objValue) ? srcValue : objValue;
 * }
 *
 * var defaults = _.partialRight(_.assignInWith, customizer);
 *
 * defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
 * // => { 'a': 1, 'b': 2 }
 */
var assignInWith = createAssigner(function(object, source, srcIndex, customizer) {
  copyObject(source, keysIn(source), object, customizer);
});

/**
 * Assigns own and inherited enumerable string keyed properties of source
 * objects to the destination object for all destination properties that
 * resolve to `undefined`. Source objects are applied from left to right.
 * Once a property is set, additional values of the same property are ignored.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @since 0.1.0
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @see _.defaultsDeep
 * @example
 *
 * _.defaults({ 'a': 1 }, { 'b': 2 }, { 'a': 3 });
 * // => { 'a': 1, 'b': 2 }
 */
var defaults = baseRest(function(args) {
  args.push(undefined, assignInDefaults);
  return apply(assignInWith, undefined, args);
});

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @since 3.0.0
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  return isArrayLike(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
}

module.exports = defaults;

},{}]},{},[1]);
