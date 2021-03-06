var $ = require('jquery');
var Loggr = require('../../../../modules/loggr');
var defaults = require('lodash.defaults');
var JSONF = require('../../../../modules/jsonf');
var m = require('mithril');
var Ws4ever = require('../../../../modules/ws4ever');

var CommandList = require('../command-list');
var COMMANDS = require('../../../../modules/browser-puppeteer').COMMANDS;
var MESSAGES = require('../../../../modules/browser-puppeteer').MESSAGES;

var EOL = '\n';

var JSON_OUTPUT_FORMATTER_NAME = 'json (built-in)';
var NOSTROMO_OUTPUT_FORMATTER_NAME = 'nostromo (built-in)';
var DEFAULT_OUTPUT_FILENAME = 'output';

var MOCK_MESSAGE_INTERVAL = 500;

var RootComp;

window.RecorderApp = RecorderApp;

// TODO browserPuppet port as config param

/**
 * @param {RecorderOptions|String} conf - RecorderOptions as Object or String
 */
function RecorderApp(conf) {
    var self = this;
    var confObj = conf;

    if (typeof confObj === 'string') {
        confObj = JSONF.parse(confObj);
    }

    self._conf = defaults({}, confObj, {
        // TODO move these to recorder server?
        pressKeyFilter: function (data) {
            return [13, 27].indexOf(data.command.keyCode) >= 0;
        },
        captureFilter: noop,
        onChangeEvent: noop,
        outputFormatters: [],
        selectedOutputFormatter: JSON_OUTPUT_FORMATTER_NAME,
    });

    self._conf.outputFormatters.unshift(
        {
            name: JSON_OUTPUT_FORMATTER_NAME,
            filename: 'recorder_output.json',
            fn: jsonOutputFormatter,
        },
        {
            name: NOSTROMO_OUTPUT_FORMATTER_NAME,
            filename: 'recorder_output.js',
            fn: renderTestfile,
        }
    );

    self._log = new Loggr({
        // TODO logLevel
        logLevel: Loggr.LEVELS.ALL,
        namespace: 'RecorderApp',
    });

    self._wsConn = null;
    self.commandList = new CommandList({
        compositeEvents: self._conf.compositeEvents,
        compositeEventsThreshold: self._conf.compositeEventsThreshold,
        compositeEventsComparator: self._conf.compositeEventsComparator,
    });

    self._isRecording = false;

    if (self._conf._preEnableRecording === true) {
        self._isRecording = true;
    }

    self._scrollToBottomFlag = false;

    self.actions = {
        toggleRecording: function () {
            self._isRecording = !self._isRecording;
        },
        clearRecording: function () {
            self.commandList.clear();
        },
        addAssertion: function () {
            self.commandList.add({ type: COMMANDS.ASSERT });
        },
        downloadOutput: function () {
            var formatter = self._getSelectedOutputFormatter();
            var output = self._getFormattedOutput();
            var blob = new Blob([output], { type: 'application/octet-stream' });
            var dlTarget = document.getElementById('download-target');
            var dlUrl = window.URL.createObjectURL(blob);

            dlTarget.href = dlUrl;
            dlTarget.download = formatter.filename || DEFAULT_OUTPUT_FILENAME;
            dlTarget.click();
        },
        selectOutputFormatter: function (event) {
            self._conf.selectedOutputFormatter = event.target.value;
        },
    };

    self._onContentVNodeUpdate = self._onContentVNodeUpdate.bind(self);
}

// TODO promise, resolve when loaded
RecorderApp.prototype.start = function () {
    var self = this;
    self._wsConn = new Ws4ever(location.origin.replace('http://', 'ws://'));
    self._wsConn.onmessage = self._onWsMessage.bind(self);
    self._wsConn.onopen = self._onWsOpen.bind(self);

    var MountComp = {
        view: function () {
            return m(RootComp, { app: self, actions: self.actions });
        },
    };

    m.mount($('#mount')[0], MountComp);
};

RecorderApp.prototype._onWsMessage = function (event) {
    var data = event.data;

    try {
        data = JSONF.parse(data);

        switch (data.type) {
            case MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE:
                this.onSelectorBecameVisibleEvent(data);
                break;
            case MESSAGES.UPSTREAM.CAPTURED_EVENT:
                this._onCapturedEvent(data.event);
                break;
            case MESSAGES.UPSTREAM.INSERT_ASSERTION:
                if (this._isRecording) {
                    this.commandList.add({ type: COMMANDS.ASSERT });
                }
                break;
            default: throw new Error('Unknown message type: ' + data.type);
        }

        this._scrollToBottomFlag = true;
    }
    catch (err) {
        console.error(err);
    }
    finally {
        m.redraw();
    }
};

RecorderApp.prototype._onWsOpen = function () {
    if (this._conf._mockMessages.length > 0) {
        this._runNextMockMessage();
    }
};

RecorderApp.prototype._runNextMockMessage = function (index) {
    var self = this;

    if (index === undefined) {
        index = 0;
    }

    if (index >= self._conf._mockMessages.length) {
        return;
    }

    var currentMockMessage = self._conf._mockMessages[index];

    setTimeout(function () {
        try {
            self._onWsMessage({
                data: JSONF.stringify(currentMockMessage),
            });
        }
        catch (err) {
            console.error(err);
        }

        self._runNextMockMessage(index + 1);
    }, MOCK_MESSAGE_INTERVAL);
};

RecorderApp.prototype._getSelectedOutputFormatter = function () {
    var self = this;
    var filtered = self._conf.outputFormatters.filter(function (formatter) {
        return formatter.name === self._conf.selectedOutputFormatter;
    });

    if (filtered.length !== 1) {
        return function () {
            return '(formatter "' + self._conf.selectedOutputFormatter + '" not found)';
        };
    }

    return filtered[0];
};

RecorderApp.prototype._getFormattedOutput = function () {
    return this._getSelectedOutputFormatter().fn(this.commandList.getList());
};

RecorderApp.prototype._onCapturedEvent = function (event) {
    if (!this._isRecording) {
        return;
    }

    if (event.type === 'change') {
        this._conf.onChangeEvent({ event: event, recorderInstance: this });
        return;
    }

    var command;

    switch (event.type) {
        case 'input':
            command = this._getCommandFromInputEvent(event);
            break;
        case 'keydown':
            command = this._getCommandFromKeydownEvent(event);
            break;
        case 'scroll':
            command = this._getCommandFromScrollEvent(event);
            break;
        case 'click':
            command = this._getCommandFromClickEvent(event);
            break;
        case 'focus':
            command = this._getCommandFromFocusEvent(event);
            break;
        case 'mouseover':
            command = this._getCommandFromMouseoverEvent(event);
            break;
        default:
            console.error('Unknown event type: ' + event.type + ', event:', event);
            return;
    }

    if (this._conf.captureFilter({ event: event, command: command, recorderInstance: this }) === false) {
        this._log.info('capture prevented by captureFilter');
        this._log.trace('prevented event: ' + JSON.stringify(event));
        this._log.trace('prevented command: ' + JSON.stringify(command));
        return;
    }

    if (command.type === 'pressKey' && this._conf.pressKeyFilter({ event: event, command: command, recorderInstance: this }) === false) {
        return;
    }

    this.addCommand(command);
};

RecorderApp.prototype._getCommandFromInputEvent = function (event) {
    return {
        type: 'setValue',
        $timestamp: event.$timestamp,
        selector: event.selector,
        value: event.value,
    };
};

RecorderApp.prototype._getCommandFromKeydownEvent = function (event) {
    return {
        type: 'pressKey',
        $timestamp: event.$timestamp,
        selector: event.selector,
        keyCode: event.keyCode,
    };
};

RecorderApp.prototype._getCommandFromScrollEvent = function (event) {
    return {
        type: 'scroll',
        $timestamp: event.$timestamp,
        selector: event.selector,
        scrollTop: event.target.scrollTop,
    };
};

RecorderApp.prototype._getCommandFromClickEvent = function (event) {
    return {
        type: 'click',
        $timestamp: event.$timestamp,
        selector: event.selector,
        $fullSelectorPath: event.$fullSelectorPath,
    };
};

RecorderApp.prototype._getCommandFromFocusEvent = function (event) {
    return {
        type: 'focus',
        $timestamp: event.$timestamp,
        selector: event.selector,
        $fullSelectorPath: event.$fullSelectorPath,
    };
};

RecorderApp.prototype._getCommandFromMouseoverEvent = function (event) {
    return {
        type: 'mouseover',
        $timestamp: event.$timestamp,
        selector: event.selector,
    };
};

RecorderApp.prototype.addCommand = function (cmd) {
    this.commandList.add(cmd);
};

RecorderApp.prototype._onContentVNodeUpdate = function (vnode) {
    if (this._scrollToBottomFlag) {
        this._scrollToBottomFlag = false;

        vnode.dom.scrollTop = vnode.dom.scrollHeight;
    }
};

RecorderApp.prototype.onSelectorBecameVisibleEvent = function (data) {
    if (!this._isRecording) {
        return;
    }

    var rule = null;

    this._conf.onSelectorBecameVisible.forEach(function (sbvRule) {
        if (sbvRule.selector === data.selector) {
            rule = sbvRule;
        }
    });

    if (!rule) {
        console.error('SelectorBecameVisible rule not found for selector ' + data.selector);
    }
    else {
        rule.listener(this);
    }
};

RootComp = {
    view: function (vnode) {
        var app = vnode.attrs.app;
        var actions = vnode.attrs.actions;

        var toggleBtnClass = app._isRecording
            ? 'button--toggle-on'
            : 'button--toggle-off';

        return <main>
            <nav>
                <button class={ toggleBtnClass } onclick={ actions.toggleRecording }>Toggle recording</button>
                <button onclick={ actions.addAssertion }>Add assertion</button>
                <button onclick={ actions.downloadOutput }>Download output</button>
                <button class="button--danger clear-recording-btn" onclick={ actions.clearRecording }>Clear recording</button>
            </nav>

            <div class="content" onupdate={ app._onContentVNodeUpdate }>
                <section>
                    <div class="info-bar">
                        <div class="info-icon"></div>
                        Press Ctrl+Shift while recording to insert an assertion.
                    </div>
                </section>

                <section>
                    <p class="flex-row">
                        Output format:
                        <select class="output-format-dropdown" onchange={ actions.selectOutputFormatter }>{
                            app._conf.outputFormatters.map(function (formatter) {
                                return <option
                                    selected={ formatter.name === app._conf.selectedOutputFormatter }
                                    value={ formatter.name }>
                                    { formatter.name }
                                </option>;
                            })
                        }</select>
                    </p>
                </section>

                <section>
                    <pre class="output">{ app._getFormattedOutput() }</pre>
                </section>
            </div>

            <a href="#" id="download-target" class="hidden"></a>
        </main>;
    },
};

// remove meta (keys starting with $)
function cleanCmd(cmd) {
    var o = {};

    Object.keys(cmd).forEach(function (k) {
        if (k[0] !== '$') {
            o[k] = cmd[k];
        }
    });

    return o;
}

function jsonOutputFormatter(cmds, rawIndent) {
    var indent = rawIndent || '    ';

    if (cmds.length === 0) {
        return '[]';
    }

    return '[' + EOL +
        cmds.map(function (cmd) {
            if (cmd.type === COMMANDS.COMPOSITE) {
                return indent + '{"type":"' + COMMANDS.COMPOSITE + '","commands":[' + EOL +
                    cmd.commands.map(function (subcmd) {
                        return indent + indent + JSON.stringify(cleanCmd(subcmd));
                    }).join(',' + EOL) + EOL +
                indent + ']}';
            }

            return indent + JSON.stringify(cleanCmd(cmd));

        }).join(',' + EOL) + EOL +
        ']' + EOL;
}

// TODO move to own file
function renderTestfile(cmds, rawIndent) {
    var indent = rawIndent || '    ';

    var res = [
        '\'use strict\';',
        '',
        'exports = module.exports = function (test) {',
        indent + 'test(\'\', async (t) => {',
    ];

    cmds.forEach(function (cmd) {
        res.push(indent + indent + 'await ' + renderCmd(cmd, indent) + ';');
    });

    res.push(
        indent + '});',
        '};',
        ''
    );

    return res.join(EOL);
}

// TODO move to own file
// TODO use js formatter module
function renderCmd(cmd, indent) {
    switch (cmd.type) {
        case 'setValue': return 't.setValue(' + apos(cmd.selector) + ', ' + apos(cmd.value) + ')';
        case 'pressKey': return 't.pressKey(' + apos(cmd.selector) + ', ' + cmd.keyCode + ')';
        case 'scroll': return 't.scroll(' + apos(cmd.selector) + ', ' + cmd.scrollTop + ')';
        case 'click': return 't.click(' + apos(cmd.selector) + ')';
        case 'waitForVisible': return 't.waitForVisible(' + apos(cmd.selector) + ')';
        case 'waitWhileVisible': return 't.waitWhileVisible(' + apos(cmd.selector) + ')';
        case 'focus': return 't.focus(' + apos(cmd.selector) + ')';
        case 'assert': return 't.assert()';
        case 'comment': return 't.comment(' + apos(cmd.comment) + ')';

        case 'composite': return 't.composite([' + EOL +
            cmd.commands.map(function (subcmd) {
                return indent + indent + indent + inspectObj(cleanCmd(subcmd));
            }).join(',' + EOL) + EOL +
        indent + indent + '])';

        case 'uploadFileAndAssign': return 't.uploadFileAndAssign({' + EOL +
            indent + indent + indent + 'selector: ' + apos(cmd.selector) + ',' + EOL +
            indent + indent + indent + 'filePath: ' + apos(cmd.filePath) + ',' + EOL +
            indent + indent + indent + 'destinationVariable: ' + apos(cmd.destinationVariable) + EOL +
        indent + indent + '})';

        case 'mouseover': return 't.mouseover(' + apos(cmd.selector) + ')';
        // case '': return 't.()'
        default: console.error('unknown cmd type ', cmd.type, cmd); return '<unknown: ' + JSON.stringify(cmd) + '>';
    }
}

function apos(s) {
    return '\'' + String(s).replace(/'/g, '\\\'') + '\'';
}

function noop() {}

function inspectObj(o) {
    return '{ ' + Object.keys(o).map(function (k) {
        return k + ': ' + inspectVal(o[k]);
    }).join(', ') + ' }';
}

function inspectVal(v) {
    switch (typeof v) {
        case 'string': return '\'' + v + '\'';
        case 'boolean': return v ? 'true' : 'false';
        default: return v;
    }
}
