'use strict';

var _ = require('lodash');
var $ = require('jquery');
var Promise = require('bluebird');
// var css=require('./src/styles/index.styl')
// var views=require('./views.msx')
// TODO move to Puppet
var UniqueSelector = require('get-unique-selector');
// var utils = require('./utils')
var Loggr = require('loggr');
var defaults = require('shallow-defaults');
// var EventEmitter=require('events').EventEmitter
var util = require('util');
var JSONF = require('jsonf');
var m = require('mithril');
var Ws4ever = require('ws4ever');

var CommandList = require('../../../command-list');
var CMD_TYPES = require('../../../command').TYPES;

// TODO better require
var MESSAGES = require('../../../../node_modules/browser-puppeteer/src/messages.js');

var EOL = '\n';

window.RecorderApp = RecorderApp;

// TODO record command times, compare to tested times?

// TODO handle if connection was lost?

// TODO beforeCommand: provide raw data AND next command as param
// TODO support touch events

// TODO executable specifications? (image list with command target highlights)
//      or play macro step-by-step?

function RecorderApp(conf) {
    var self = this;

    // EventEmitter.call(self)

    if (typeof conf === 'string') {
        conf = JSONF.parse(conf);
    }

    self._conf = conf || {};

    self._log = new Loggr({
        logLevel: Loggr.LEVELS.ALL, // TODO logLevel
        namespace: 'MacroRecorder'
    });

    self._wsConn = null;
    self.commandList = new CommandList();

    self._isRecording = false;

    self.actions = {
        toggleRecording: function toggleRecording() {
            self._isRecording = !self._isRecording;
        },
        clearRecording: function clearRecording() {
            self.commandList.clear();
        },
        addScreenshotAssert: function addScreenshotAssert() {
            self.commandList.add({ type: CMD_TYPES.ASSERT_SCREENSHOT });
        },
        downloadTestfile: function downloadTestfile() {
            var testFileStr = renderTestfile(self.commandList);
            var blob = new Blob([testFileStr], { type: 'application/octet-stream' });
            var dlTarget = document.getElementById('download-target');
            var dlUrl = window.URL.createObjectURL(blob);
            dlTarget.href = dlUrl;
            dlTarget.download = 'testfile.js';
            dlTarget.click();
        }
    };
}

// util.inherits(RecorderApp,EventEmitter)

// TODO promise, resolve when loaded
RecorderApp.prototype.start = function () {
    var self = this;
    self._wsConn = new Ws4ever(location.origin.replace('http://', 'ws://'));

    self._wsConn.onmessage = function (e) {
        var data = e.data;

        try {
            data = JSONF.parse(data);

            switch (data.type) {
                case MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE:
                    self.onSelectorBecameVisibleEvent(data);
                    break;
                case MESSAGES.UPSTREAM.CAPTURED_EVENT:
                    self.onCapturedEvent(data);
                    break;
                case MESSAGES.UPSTREAM.INSERT_SCREENSHOT_ASSERT:
                    if (self._isRecording) self.commandList.add({ type: CMD_TYPES.ASSERT_SCREENSHOT });
                    break;
                default:
                    throw new Error('Unknown type' + data.type);
            }

            m.redraw();
        } catch (e) {
            console.warn('message error: ' + e);
        }
    };

    var MountComp = {
        view: function view() {
            return m(RootComp, { app: self, actions: self.actions });
        }
    };

    m.mount($('#mount')[0], MountComp);
};

RecorderApp.prototype.onCapturedEvent = function (data) {
    if (!this._isRecording) return;

    var event = data.event;

    // TODO use command instead of raw capture data
    // type, target, $target, selector
    var beforeCaptureData = {
        type: event.type,
        target: event.target,
        selector: event.selector
    };

    if (this._conf.beforeCapture(beforeCaptureData) === false) {
        console.log('capture prevented in onBeforeCapture');
        return;
    }

    switch (event.type) {
        case 'input':
            event.type = 'setValue';
            break;
        case 'keypress':
            event.type = 'pressKey';
            break;
        case 'scroll':
            event.scrollTop = event.target.scrollTop;
            break;
        case 'click':
            event.message = 'Click "' + event.target.innerText + '" (' + event.selector + ')';
        default:
            break;
    }

    delete event.target;

    this.commandList.add(event);
};

// record.conf.js API
RecorderApp.prototype.addCommand = function (cmd) {
    this.commandList.add(cmd);
};

RecorderApp.prototype.onSelectorBecameVisibleEvent = function (data) {
    if (!this._isRecording) return;

    var rule = null;

    this._conf.onSelectorBecameVisible.forEach(function (sbvRule) {
        if (sbvRule.selector === data.selector) {
            rule = sbvRule;
        }
    });

    if (!rule) {
        console.error('SBV rule not found for selector ' + data.selector);
    } else {
        rule.listener(this);
    }
};

var RootComp = {
    view: function view(vnode) {
        var app = vnode.attrs.app;
        var actions = vnode.attrs.actions;

        return m(
            'div',
            null,
            m(
                'button',
                { onclick: actions.toggleRecording },
                'Toggle recording'
            ),
            '\xA0',
            m(
                'button',
                { onclick: actions.clearRecording },
                'Clear recording'
            ),
            '\xA0',
            m(
                'button',
                { onclick: actions.addScreenshotAssert },
                'Add screenshot assert'
            ),
            '\xA0',
            m(
                'button',
                { onclick: actions.downloadTestfile },
                'Download testfile'
            ),
            '\xA0 | ',
            app._isRecording ? 'Recording' : 'Not recording',
            m(
                'div',
                null,
                m(
                    'ul',
                    null,
                    app.commandList.map(function (cmd) {
                        return m(
                            'li',
                            null,
                            util.inspect(cmd),
                            ','
                        );
                    })
                )
            ),
            m('hr', null),
            m(
                'div',
                null,
                m(
                    'pre',
                    null,
                    renderTestfile(app.commandList)
                )
            ),
            m('a', { href: '#', id: 'download-target', 'class': 'hidden' })
        );
    }

    // TODO move these to Command or CommandList?
};function renderTestfile(cmds, indent) {
    indent = indent || '    ';

    var res = ['\'use strict\';', '', 'exports = module.exports = function (test) {', indent + 'test(\'\', t => {'];

    cmds.forEach(function (cmd, i) {
        if (i === 0) res.push(indent + indent + 'return ' + renderCmd(cmd));else res.push(indent + indent + '.then(() => ' + renderCmd(cmd) + ')');
    });

    res.push(indent + '});', '};', '');

    return res.join(EOL);
}

// TODO move these to Command or CommandList?
function renderCmd(cmd) {
    switch (cmd.type) {
        case 'setValue':
            return 't.setValue(' + apos(cmd.selector) + ', ' + apos(cmd.value) + ')';
        case 'pressKey':
            return 't.pressKey(' + apos(cmd.selector) + ', ' + apos(cmd.keyCode) + ')';
        case 'scroll':
            return 't.scroll(' + apos(cmd.selector) + ', ' + apos(cmd.scrollTop) + ')';
        case 'click':
            return 't.click(' + apos(cmd.selector) + ')';
        case 'waitForVisible':
            return 't.waitForVisible(' + apos(cmd.selector) + ')';
        case 'waitWhileVisible':
            return 't.waitWhileVisible(' + apos(cmd.selector) + ')';
        case 'focus':
            return 't.focus(' + apos(cmd.selector) + ')';
        case 'assertScreenshot':
            return 't.assertScreenshot()';
        // case '': return 't.()'
        default:
            console.error('unknown cmd type ', cmd.type, cmd);return '<unknown>';
    }
}

function apos(s) {
    return '\'' + String(s).replace(/'/g, '\\\'') + '\'';
}

function promiseWhile(condition, action) {
    return Promise.try(function () {
        if (!condition()) {
            return;
        }

        return action().then(promiseWhile.bind(null, condition, action));
    });
}

function deepCopy(o) {
    return JSONF.parse(JSONF.stringify(o));
}

function capitalize(str) {
    return str[0].toUpperCase + str.slice(1);
}

function noop() {}

function nl2backslashnl(str) {
    return str.replace(/\n/g, '\\n');
}
