'use strict';

var Promise = require('bluebird');
var $ = require('jquery'); $.noConflict();
var jQuery=$
var MESSAGES = require('../messages');
var JSONF = require('../../../../modules/jsonf');
var UniqueSelector = require('../../../../modules/get-unique-selector');
var SS_MARKER_IMG = require('../screenshot-marker').base64;
var debounce = require('lodash.debounce');
var Ws4ever=require('../../../../modules/ws4ever');

// TODO option to transmit console?
// TODO transmit uncaught exceptions

// TODO use MutationObserver if available, fallback to polling ?
var AUTODETECT_INTERVAL_MS = 300;

var DEFAULT_PORT = 47225;

exports = module.exports = BrowserPuppet;

// TODO detect scroll events and transmit them

/**
 * @param {Object} opts
 * @param {String} opts.url
 */
function BrowserPuppet(opts) {
    this._opts = opts || {};

    this._opts.url = this._opts.url || 'ws://localhost:' + DEFAULT_PORT;

    // TODO nem kell?
    this._isSelectorVisible = this._opts.isSelectorVisible || this._defaultIsSelectorVisible;

    assert(this._opts.url && /^ws:\/\/.+/.test(this._opts.url), 'BrowserPuppet: missing or invalid url, expected "ws://..."');

    this._transmitEvents = false;
    this._isExecuting = false;

    this._wsConn = null;

    this._uniqueSelector = new UniqueSelector();

    this._onSelectorBecameVisibleData = {
        intervalId: null,
        // Array<String>
        selectors: [],
        // Array<{previousState:Boolean}>
        states: [],
    };

    this._scheduleReopen = false
    this._scheduleReopenUrl = ''

    this._ssMarkerTL = document.createElement('div');
    this._ssMarkerTL.setAttribute('style', 'position:absolute;top:0;left:0;width:4px;height:4px;z-index:16777000;');
    this._ssMarkerTL.style.background = 'url(' + SS_MARKER_IMG + ')';

    this._ssMarkerBR = document.createElement('div');
    this._ssMarkerBR.setAttribute('style', 'position:absolute;bottom:0;right:0;width:4px;height:4px;z-index:16777000;');
    this._ssMarkerBR.style.background = 'url(' + SS_MARKER_IMG + ')';
}

BrowserPuppet.prototype.start = function () {
    this._startWs();
    this._attachCaptureEventListeners();
    this._startOnSelectorBecameVisiblePolling();
};

BrowserPuppet.prototype._startWs = function () {
    var self = this;

    self._wsConn = new Ws4ever(self._opts.url);
    self._wsConn.onmessage = function (e) {
        self._onMessage(e.data);
    };
    self._wsConn.onerror = function (err) {
        console.error(err);
    };
};

BrowserPuppet.prototype._sendMessage = function (data) {
    if (typeof data === 'object') {
        data = JSONF.stringify(data);
    }
    this._wsConn.send(data);
};

BrowserPuppet.prototype._defaultIsSelectorVisible = function (selector, jQuery) {
    return jQuery(selector).is(':visible');
};

BrowserPuppet.prototype._onMessage = function (data) {
    var self = this;

    // no return
    Promise.try(function () {
        data = JSONF.parse(data);

        switch (data.type) {
            case MESSAGES.DOWNSTREAM.EXEC_COMMAND:
            case MESSAGES.DOWNSTREAM.EXEC_FUNCTION:
                self._isExecuting = true;
                return self._onExecMessage(data);

            case MESSAGES.DOWNSTREAM.SET_SELECTOR_BECAME_VISIBLE_DATA:
                return self.setOnSelectorBecameVisibleSelectors(data.selectors);

            case MESSAGES.DOWNSTREAM.SHOW_SCREENSHOT_MARKER:
                return self.setScreenshotMarkerState(true);
            case MESSAGES.DOWNSTREAM.HIDE_SCREENSHOT_MARKER:
                return self.setScreenshotMarkerState(false);

            case MESSAGES.DOWNSTREAM.SET_TRANSMIT_EVENTS:
                return self.setTransmitEvents(data.value);

            case MESSAGES.DOWNSTREAM.REOPEN_URL:
                self.reopenUrl(data.url)
                // self._scheduleReopen = true
                // self._scheduleReopenUrl = data.url
                return

            default:
                throw new Error('BrowserPuppet: unknown message type: ' + data.type);
        }
    })
    .then(function (result) {
        self._sendMessage({ type: MESSAGES.UPSTREAM.ACK, result: result });
    })
    .then(function () {
        // if (self._scheduleReopen) {
        //     return self.reopenUrl(self._scheduleReopenUrl)
        // }
    })
    .catch(function (err) {
        var errorDTO = {};

        Object.keys(err).forEach(function (key) {
            if (!err.hasOwnProperty(key)) {
                return;
            }
            errorDTO[key] = err[key];
        });

        errorDTO.message = err.message;

        self._sendMessage({ type: MESSAGES.UPSTREAM.NAK, error: errorDTO });
    })
    .finally(function () {
        self._isExecuting = false;
    });
};

BrowserPuppet.prototype._canCapture = function () {
    return this._transmitEvents && !this._isExecuting;
}

BrowserPuppet.prototype._attachCaptureEventListeners = function () {
    document.addEventListener('click', this._onClickCapture.bind(this), true);
    document.addEventListener('focus', this._onFocusCapture.bind(this), true);
    document.addEventListener('input', this._onInputCapture.bind(this), true);
    document.addEventListener('scroll', this._onScrollCapture.bind(this), true);
    document.addEventListener('keydown', this._onKeydownCapture.bind(this), true);
};

var SHIFT_KEY = 16;
var CTRL_KEY = 17;

BrowserPuppet.prototype._onClickCapture = function (event) {
    if (!this._canCapture()) {
        return
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'click',
            selector: selector,
            target: {
                innerText: target.innerText
            },
        },
    });
}

BrowserPuppet.prototype._onFocusCapture = function (event) {
    if (!this._canCapture()) {
        return
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'focus',
            selector: selector,
            target: {
                innerText: target.innerText
            },
        },
    });
}

BrowserPuppet.prototype._onInputCapture = function (event) {
    if (!this._canCapture()) {
        return
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'input',
            selector: selector,
            value: target.value,
            target: {
                innerText: target.innerText
            },
        },
    });
}

var SCROLL_DEBOUNCE = 500;

BrowserPuppet.prototype._onScrollCapture = debounce(function (event) {
    if (!this._canCapture()) {
        return
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'scroll',
            selector: selector,
            target: {
                scrollTop: target.scrollTop,
                innerText: target.innerText,
            },
        },
    });
}, SCROLL_DEBOUNCE)

BrowserPuppet.prototype._onKeydownCapture = function (event) {
    if (!this._canCapture()) {
        return
    }

    if (event.keyCode === SHIFT_KEY && event.ctrlKey === true ||
        event.keyCode === CTRL_KEY && event.shiftKey === true) {

        this._sendInsertAssertionDebounced()
        return
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'keydown',
            selector: selector,
            keyCode: event.keyCode || event.charCode,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            target: cleanTarget(target),
        },
    })
}

var INSERT_ASSERTION_DEBOUNCE = 500

BrowserPuppet.prototype._sendInsertAssertionDebounced = debounce(function () {
    this._sendMessage({ type: MESSAGES.UPSTREAM.INSERT_ASSERTION });
}, INSERT_ASSERTION_DEBOUNCE)

BrowserPuppet.prototype.setOnSelectorBecameVisibleSelectors = function (selectors) {
    this._onSelectorBecameVisibleData.selectors = deepCopy(selectors);
    this._onSelectorBecameVisibleData.states = selectors.map(function () {
        return { previousState: null };
    });
};

BrowserPuppet.prototype.setTransmitEvents = function (value) {
    if (typeof value !== 'boolean') {
        throw new Error('BrowserPuppet::setTransmitEvents: invalid type for value');
    }
    this._transmitEvents = value;
};

BrowserPuppet.prototype._startOnSelectorBecameVisiblePolling = function () {
    this._onSelectorBecameVisibleData.intervalId =
        setInterval(this._onSelectorBecameVisiblePoll.bind(this), AUTODETECT_INTERVAL_MS);
};

BrowserPuppet.prototype._onSelectorBecameVisiblePoll = function () {
    var self = this;

    self._onSelectorBecameVisibleData.selectors.forEach(function (selector, i) {
        var state = self._onSelectorBecameVisibleData.states[i];

        // TODO send warning in message if selector is ambiguous

        var currentState = self._isSelectorVisible(selector, jQuery);

        if (state.previousState !== null && !state.previousState && currentState) {
            self._sendMessage({ type: MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, selector: selector });
        }

        state.previousState = currentState;
    });
};

BrowserPuppet.prototype._onCaptureEvent = function (eventType, event) {
    if (!this._transmitEvents || this._isExecuting) {
        return;
    }

    var target = event.target;

    // if (eventType === 'keypress' && target.tagName === 'INPUT') {
    //     return;
    // }

    try {
        var selector = this._uniqueSelector.get(target);
    }
    catch (err) {
        console.error(err)
        return
    }

    var response = {
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: eventType,
            selector: selector,
            target: {
                tagName: target.tagName,
                id: target.id,
                className: target.className,
            },
        },
    };

    // click focus keypress input scroll

    if (/click/.test(eventType)) {
        response.event.target.innerText = target.innerText;
    }

    switch (eventType) {
        case 'keypress':
            // TODO handle contenteditable fields, textarea, etc
            response.event.keyCode = event.keyCode || event.charCode;
            break;
        case 'input':
            response.event.value = target.value;
            break;
        case 'scroll':
            response.event.target.scrollTop = target.scrollTop;
        default:
            // no op
            break;
    }

    this._sendMessage(response);
};

BrowserPuppet.prototype._onExecMessage = Promise.method(function (data) {
    if (data.type === MESSAGES.DOWNSTREAM.EXEC_COMMAND) {
        var command = data.command;

        switch (command.type) {
            case 'click':
                return this.click(command.selector);
            case 'setValue':
                return this.setValue(command.selector, command.value);
            case 'getValue':
                return this.getValue(command.selector);
            case 'pressKey':
                return this.pressKey(command.selector, command.keyCode);
            case 'waitForVisible':
                return this.waitForVisible(command.selector);
            case 'waitWhileVisible':
                return this.waitWhileVisible(command.selector);
            case 'focus':
                return this.focus(command.selector);
            case 'isVisible':
                return this.isVisible(command.selector);
            default:
                throw new Error('Unknown command type: ' + command.type);
        }
    }
    else if (data.type === MESSAGES.DOWNSTREAM.EXEC_FUNCTION) {
        // TODO
        throw new Error('TODO: EXEC_FUNCTION');
    }
    else {
        throw new Error('Unknown exec type: ' + data.type);
    }
});

BrowserPuppet.prototype._execFn = Promise.method(function (fnData) {
    var argNames = fnData.argNames || [];
    var argValues = fnData.argValues || [];
    var fnBody = fnData.body;

    var fn;

    /* eslint-disable no-new-func */

    switch (argNames.length) {
        case 0: fn = new Function(fnBody);
            break;
        case 1: fn = new Function(argNames[0], fnBody);
            break;
        case 2: fn = new Function(argNames[0], argNames[1], fnBody);
            break;
        case 3: fn = new Function(argNames[0], argNames[1], argNames[2], fnBody);
            break;
        case 4: fn = new Function(argNames[0], argNames[1], argNames[2], argNames[3], fnBody);
            break;
        case 5: fn = new Function(argNames[0], argNames[1], argNames[2], argNames[3], argNames[4], fnBody);
            break;
        case 6: fn = new Function(argNames[0], argNames[1], argNames[2], argNames[3], argNames[4], argNames[5], fnBody);
            break;
        default: throw new Error('Too many args');
            break;
    }

    /* eslint-enable no-new-func */

    // TODO custom context?
    var context = {
        driver: this,
        $: $,
        // TODO kell?
        jQuery: $,
        promiseWhile: promiseWhile,
        Promise: Promise,
    };

    return fn.apply(context, argValues);
});

BrowserPuppet.prototype.reopenUrl = Promise.method(function (url) {
    this._wsConn.close()
    document.cookie = ''
    window.localStorage.clear()
    window.location = url
})

// command

BrowserPuppet.prototype.click = function (selector) {
    var $el = $(selector);

    if ($el.length === 0) {
        throw new Error('Unable to click selector "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to click selector "' + selector + '": not unique');
    }
    else {
        var el = $el[0];

        // TODO inaccessible context !!!

        // if (TestToolsBase.isNodeOccluded(el)) {
        //     var occludingNode = TestToolsBase.getOccludingNode(el)
        //     console.log('OCCLUSION DETECTED - selector: ' + selector + ', occluded by: ' + occludingNode.outerHTML.substr(0,50) + ' (...)')
        //     throw new Error('Unable to click selector "'+selector+'": is occluded by other node(s)')
        // }

        // console.log('No occlusion detected for '+selector)

        $el.trigger('click');
    }
};

// TODO handle meta keys, arrow keys
BrowserPuppet.prototype.pressKey = function (selector, keyCode) {
    var $el = $(selector);

    if ($el.length === 0) {
        throw new Error('Unable to press key ' + keyCode + ' for "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to press key ' + keyCode + ' for "' + selector + '": not unique');
    }
    else {
        $el.trigger($.Event('keypress', { which: keyCode, keyCode: keyCode }));
    }
};

BrowserPuppet.prototype.setValue = function (selector, value) {
    var $el = $(selector);
    var el = $el[0];
    var tagName = el && el.tagName || '';

    if ($el.length === 0) {
        throw new Error('Unable to set value of "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to set value of "' + selector + '": not unique');
    }
    else if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        throw new Error('Unable to set value of "' + selector + '": unsupported tag "' + tagName + '"');
    }
    else {
        $el.val(value);
        $el.trigger('input');
    }
};

BrowserPuppet.prototype.focus = function (selector) {
    var $el = $(selector);

    if ($el.length === 0) {
        throw new Error('Unable to focus selector "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to focus selector "' + selector + '": not unique');
    }
    else {
        $el[0].focus();
    }
};

// TODO timeout, pollInterval
// TODO document caveats
BrowserPuppet.prototype.waitForVisible = Promise.method(function (selector) {
    var pollInterval = 500;
    var self = this;

    if (self._isSelectorVisible(selector, jQuery)) {
        return;
    }

    return promiseWhile(
        function () {
            return !self._isSelectorVisible(selector, jQuery);
        },
        function () {
            return Promise.delay(pollInterval);
        }
    );
});

// TODO timeout, pollInterval, initialDelay
// TODO document caveats
BrowserPuppet.prototype.waitWhileVisible = Promise.method(function (selector) {
    var pollInterval = 500;
    var initialDelay = 500;
    var self = this;

    console.log('waitWhileVisible: starting, initialDelay: ' + initialDelay);

    return Promise.delay(initialDelay)
    .then(function () {
        if (!self._isSelectorVisible(selector, jQuery)) {
            console.log('WWV: selector wasnt visible: ' + selector);
            return;
        }

        return promiseWhile(
            function () {
                var result = self._isSelectorVisible(selector, jQuery);
                console.log('WWV: visibility: ' + selector + ', ' + result);
                return result;
            },
            function () {
                console.log('WWV: delaying');
                return Promise.delay(pollInterval);
            }
        );

    });
});


// query

BrowserPuppet.prototype.getValue = function (selector) {
    var $el = $(selector);
    var el = $el[0];

    if ($el.length === 0) {
        throw new Error('Unable to get value for "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to get value for "' + selector + '": not unique');
    }

    // TODO util fn to get node value

    // TODO handle all val() nodes
    if (el.tagName === 'INPUT' && el.type === 'checkbox') {
        return el.checked;
    }
    else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        /* nl2backslashnl(*/
        return $el.val().replace(/\n/g, '\\n');
    }
    /* nl2backslashnl(*/
    return $el.text().replace(/\n/g, '\\n');

};

BrowserPuppet.prototype.isVisible = function (selector) {
    return $(selector).length > 0;
};

BrowserPuppet.prototype.setScreenshotMarkerState = function (state) {
    if (state) {
        document.body.appendChild(this._ssMarkerTL);
        document.body.appendChild(this._ssMarkerBR);
    }
    else {
        document.body.removeChild(this._ssMarkerTL);
        document.body.removeChild(this._ssMarkerBR);
    }
};


















function cleanTarget(target){
    return {
        className: target.className,
        id: target.id,
        innerText: target.innerText,
        tagName: target.tagName,
    }
}


function deepCopy(o) {
    return JSON.parse(JSON.stringify(o));
}

function assert(v, m) {
    if (!v) {
        throw new Error(m);
    }
}


function promiseWhile(condition, action) {
    return Promise.try(function () {
        if (!condition()) {
            return;
        }

        return action()
        .then(promiseWhile.bind(null, condition, action));
    });
}
