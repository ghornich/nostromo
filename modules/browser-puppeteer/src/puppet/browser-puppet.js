'use strict';

var Promise = require('bluebird');
var $ = require('jquery'); $.noConflict();
var MESSAGES = require('../messages');
var JSONF = require('../../../../modules/jsonf');
var UniqueSelector = require('../../../../modules/get-unique-selector');
var SS_MARKER_IMG = require('../screenshot-marker').base64;
var debounce = require('lodash.debounce');
var Ws4ever = require('../../../../modules/ws4ever');
var defaults = require('lodash.defaults');
var objectAssign = require('object-assign');
var BrowserPuppetCommands = require('./browser-puppet-commands.partial');
var Loggr = require('../../../../modules/loggr');
var SelectorObserver = require('../../../../modules/selector-observer');

var INSERT_ASSERTION_DEBOUNCE = 500;

var DEFAULT_SERVER_URL = 'ws://localhost:47225';

exports = module.exports = BrowserPuppet;

/**
 * @class
 * @extends {BrowserPuppetCommands}
 * @param {Object} [opts]
 * @param {String} [opts.serverUrl=DEFAULT_SERVER_URL] - BrowserPuppeteer websocket server URL
 */
function BrowserPuppet(opts) {
    this._opts = defaults({}, opts, {
        serverUrl: DEFAULT_SERVER_URL,
    });

    assert(/^ws:\/\/.+/.test(this._opts.serverUrl), 'BrowserPuppet: missing or invalid serverUrl, expected "ws://..."');

    this._transmitEvents = false;
    this._isExecuting = false;
    this._isTerminating = false;

    this._wsConn = null;

    this.$ = $;

    this._uniqueSelector = new UniqueSelector();

    this._selectorObserver = null;
    this._mouseoverSelector = null;
    this._activeElementBeforeWindowBlur = null;

    this._log = new Loggr({
        namespace: 'BrowserPuppet',
        // TODO logLevel
        logLevel: Loggr.LEVELS.ALL,
    });

    this._ssMarkerTopLeft = document.createElement('div');
    this._ssMarkerTopLeft.className = 'browser-puppet--screenshot-marker--top-left';
    this._ssMarkerTopLeft.setAttribute('style', 'position:absolute;top:0;left:0;width:4px;height:4px;z-index:16777000;');
    this._ssMarkerTopLeft.style.background = 'url(' + SS_MARKER_IMG + ')';

    this._ssMarkerBottomRight = document.createElement('div');
    this._ssMarkerBottomRight.className = 'browser-puppet--screenshot-marker--bottom-right';
    this._ssMarkerBottomRight.setAttribute('style', 'position:absolute;bottom:0;right:0;width:4px;height:4px;z-index:16777000;');
    this._ssMarkerBottomRight.style.background = 'url(' + SS_MARKER_IMG + ')';
}

objectAssign(BrowserPuppet.prototype, BrowserPuppetCommands.prototype);

BrowserPuppet.prototype.start = function () {
    this._startWs();
    this._attachCaptureEventListeners();
};

BrowserPuppet.prototype._startWs = function () {
    var self = this;

    self._wsConn = new Ws4ever(self._opts.serverUrl);
    self._wsConn.onmessage = function (e) {
        self._onMessage(e.data);
    };
    self._wsConn.onerror = function (err) {
        self._log.error(err);
    };
};

BrowserPuppet.prototype._sendMessage = function (rawData) {
    var data = rawData;

    if (typeof data === 'object') {
        data = JSONF.stringify(data);
    }

    this._wsConn.send(data);
};

BrowserPuppet.prototype._isJQueryElementsVisible = function ($els) {
    if ($els.length === 0) {
        return false;
    }
    if (!$els.is(':visible')) {
        return false;
    }

    for (var i = 0; i < $els.length; i++) {
        var el = $els[i];
        var rect = el.getBoundingClientRect();
        var elCenterX = rect.left + rect.width / 2;
        var elCenterY = rect.top + rect.height / 2;
        var elFromPoint = document.elementFromPoint(elCenterX, elCenterY);

        if (elFromPoint === el || el.contains(elFromPoint)) {
            return true;
        }
    }

    return false;
};

BrowserPuppet.prototype.isSelectorVisible = function (selector) {
    return this._isJQueryElementsVisible(this.$(selector));
};

BrowserPuppet.prototype._onMessage = function (rawData) {
    var self = this;

    if (self._isTerminating) {
        throw new Error('BrowserPuppet::_onMessage: cannot process message, puppet is terminating');
    }

    // no return
    Promise.try(function () {
        var data = JSONF.parse(rawData);

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

            case MESSAGES.DOWNSTREAM.CLEAR_PERSISTENT_DATA:
                return self.clearPersistentData();

            case MESSAGES.DOWNSTREAM.SET_MOUSEOVER_SELECTORS:
                self._mouseoverSelector = data.selectors.join(', ');
                self._attachMouseoverCaptureEventListener();
                return;

            case MESSAGES.DOWNSTREAM.SET_IGNORED_CLASSES:
                // TODO ugly
                self._uniqueSelector._opts.ignoredClasses = data.classes;
                return;

            case MESSAGES.DOWNSTREAM.SET_UNIQUE_SELECTOR_OPTIONS:
                self._uniqueSelector = new UniqueSelector(data.options);
                return;

            case MESSAGES.DOWNSTREAM.TERMINATE_PUPPET:
                self._isTerminating = true;
                return;

            default:
                throw new Error('BrowserPuppet: unknown message type: ' + data.type);
        }
    })
    .then(function (result) {
        self._log.info('Sending ACK message');
        self._sendMessage({ type: MESSAGES.UPSTREAM.ACK, result: result });
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
        errorDTO.stack = err.stack;

        self._sendMessage({ type: MESSAGES.UPSTREAM.NAK, error: errorDTO });
    })
    .finally(function () {
        self._isExecuting = false;

        if (self._isTerminating) {
            self._wsConn.close();
            self._wsConn = null;
        }
    });
};

BrowserPuppet.prototype._canCapture = function () {
    return this._transmitEvents && !this._isExecuting;
};

BrowserPuppet.prototype._attachCaptureEventListeners = function () {
    document.addEventListener('click', this._onClickCapture.bind(this), true);
    document.addEventListener('focus', this._onFocusCapture.bind(this), true);
    document.addEventListener('input', this._onInputCapture.bind(this), true);
    document.addEventListener('scroll', this._onScrollCapture.bind(this), true);
    document.addEventListener('keydown', this._onKeydownCapture.bind(this), true);
    document.addEventListener('change', this._onChangeCapture.bind(this), true);

    window.addEventListener('blur', this._onWindowBlur.bind(this));
};

BrowserPuppet.prototype._attachMouseoverCaptureEventListener = function () {
    // TODO check if listener is already attached
    document.body.addEventListener('mouseover', this._onMouseoverCapture.bind(this), true);
};

var SHIFT_KEY = 16;
var CTRL_KEY = 17;

BrowserPuppet.prototype._onClickCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
        var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'click',
            $timestamp: Date.now(),
            selector: selector,
            $fullSelectorPath: fullSelectorPath,
            target: getTargetNodeDTO(target),
        },
    });
};

BrowserPuppet.prototype._onFocusCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    if (this._activeElementBeforeWindowBlur === target) {
        this._log.debug('focus capture prevented during window re-focus');
        this._activeElementBeforeWindowBlur = null;
        return;
    }

    try {
        var selector = this._uniqueSelector.get(target);
        var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'focus',
            $timestamp: Date.now(),
            selector: selector,
            $fullSelectorPath: fullSelectorPath,
            target: getTargetNodeDTO(target),
        },
    });
};

BrowserPuppet.prototype._onInputCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
        var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'input',
            $timestamp: Date.now(),
            selector: selector,
            $fullSelectorPath: fullSelectorPath,
            value: target.value,
            target: getTargetNodeDTO(target),
        },
    });
};

var SCROLL_DEBOUNCE = 500;

BrowserPuppet.prototype._onScrollCapture = debounce(function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
        var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    var targetDTO = getTargetNodeDTO(target);
    targetDTO.scrollTop = target.scrollTop;

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'scroll',
            $timestamp: Date.now(),
            selector: selector,
            $fullSelectorPath: fullSelectorPath,
            target: targetDTO,
        },
    });
}, SCROLL_DEBOUNCE);

BrowserPuppet.prototype._onKeydownCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    if (event.keyCode === SHIFT_KEY && event.ctrlKey === true ||
        event.keyCode === CTRL_KEY && event.shiftKey === true) {

        this._sendInsertAssertionDebounced();
        return;
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
        var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'keydown',
            $timestamp: Date.now(),
            selector: selector,
            $fullSelectorPath: fullSelectorPath,
            keyCode: event.keyCode || event.charCode,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            target: getTargetNodeDTO(target),
        },
    });
};

BrowserPuppet.prototype._onChangeCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    try {
        var selector = this._uniqueSelector.get(target);
        // var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
    }
    catch (err) {
        this._log.error(err);
        return;
    }

    this._sendMessage({
        type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
        event: {
            type: 'change',
            $timestamp: Date.now(),
            selector: selector,
            // $fullSelectorPath: fullSelectorPath,
            target: getTargetNodeDTO(target),
        },
    });
};

BrowserPuppet.prototype._onMouseoverCapture = function (event) {
    if (!this._canCapture()) {
        return;
    }

    var target = event.target;

    if (this.$(target).is(this._mouseoverSelector)) {
        try {
            var selector = this._uniqueSelector.get(target);
            var fullSelectorPath = this._uniqueSelector.getFullSelectorPath(target);
        }
        catch (err) {
            this._log.error(err);
            return;
        }

        this._sendMessage({
            type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
            event: {
                type: 'mouseover',
                $timestamp: Date.now(),
                selector: selector,
                $fullSelectorPath: fullSelectorPath,
                target: getTargetNodeDTO(target),
            },
        });
    }

};

BrowserPuppet.prototype._onWindowBlur = function () {
    this._activeElementBeforeWindowBlur = document.activeElement;
};

BrowserPuppet.prototype._sendInsertAssertionDebounced = debounce(function () {
    this._sendMessage({ type: MESSAGES.UPSTREAM.INSERT_ASSERTION });
}, INSERT_ASSERTION_DEBOUNCE);

BrowserPuppet.prototype.setOnSelectorBecameVisibleSelectors = function (selectors) {
    var self = this;

    if (self._selectorObserver !== null) {
        self._selectorObserver.disconnect();
        self._selectorObserver = null;
    }

    // TODO check _canCapture

    var observeList = selectors.map(function (selector) {
        return {
            selector: selector,
            listener: self._sendMessage.bind(self, { type: MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, selector: selector }),
        };
    });

    this._selectorObserver = new SelectorObserver({ observeList: observeList });
};

BrowserPuppet.prototype.setTransmitEvents = function (value) {
    if (typeof value !== 'boolean') {
        throw new Error('BrowserPuppet::setTransmitEvents: invalid type for value');
    }
    this._transmitEvents = value;
};

BrowserPuppet.prototype._onExecMessage = Promise.method(function (data) {
    if (data.type === MESSAGES.DOWNSTREAM.EXEC_COMMAND) {
        return this.execCommand(data.command);
    }
    else if (data.type === MESSAGES.DOWNSTREAM.EXEC_FUNCTION) {
        return this.execFunction(data.fn, data.args);
    }

    throw new Error('Unknown exec type: ' + data.type);

});

BrowserPuppet.prototype.execFunction = Promise.method(function (fn, args) {
    return fn.apply(null, args);
});

BrowserPuppet.prototype.execCommand = Promise.method(function (command) {
    this._log.trace('execCommand: ' + JSON.stringify(command));

    switch (command.type) {
        case 'click':
        case 'setValue':
        case 'getValue':
        case 'pressKey':
        case 'waitForVisible':
        case 'waitWhileVisible':
        case 'focus':
        case 'isVisible':
        case 'scroll':
        case 'mouseover':
        case 'uploadFileAndAssign':
            return this[command.type](command);

        case 'composite':
            return this.execCompositeCommand(command.commands);
        default:
            throw new Error('Unknown command type: ' + command.type);
    }
});

BrowserPuppet.prototype.execCompositeCommand = Promise.method(function (commands) {
    var self = this;

    return Promise.each(commands, function (command) {
        return self.execCommand(command);
    });
});

// TODO separate file
// from https://stackoverflow.com/a/179514/4782902
function deleteAllCookies() {
    var cookies = document.cookie.split(';');

    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i];
        var eqPos = cookie.indexOf('=');
        var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
}

BrowserPuppet.prototype.clearPersistentData = function () {
    deleteAllCookies();
    window.localStorage.clear();
};

BrowserPuppet.prototype.setScreenshotMarkerState = function (state) {
    if (state) {
        document.body.appendChild(this._ssMarkerTopLeft);
        document.body.appendChild(this._ssMarkerBottomRight);
    }
    else {
        document.body.removeChild(this._ssMarkerTopLeft);
        document.body.removeChild(this._ssMarkerBottomRight);
    }
};

function getTargetNodeDTO(target) {
    var dto = {
        className: target.className,
        id: target.id,
        innerText: target.innerText,
        tagName: target.tagName,
        type: target.type,
    };

    var attributes = target.attributes;

    __each(target.attributes, function (attr) {
        if (attr.name.indexOf('data-') === 0) {
            dto[attr.name] = attr.value;
        }
    })

    if (target.tagName === 'INPUT' && target.type === 'file') {
        dto.$fileNames = __map(target.files, function (file) { return file.name });
    }

    return dto;
}

function assert(v, m) {
    if (!v) {
        throw new Error(m);
    }
}

function __map(arrayLike, iteratee) {
    var result=[]

    for (var i=0;i<arrayLike.length;i++){
        result.push(iteratee(arrayLike[i], i, arrayLike))
    }

    return result;
}

function __each(arrayLike, iteratee) {
    for (var i=0;i<arrayLike.length;i++){
        iteratee(arrayLike[i], i, arrayLike)
    }
}