var _=require('lodash')
var $=require('jquery')
var Promise=require('bluebird')
// var css=require('./src/styles/index.styl')
// var views=require('./views.msx')
// var utils = require('./utils')
var Loggr = require('../../../../modules/loggr')
var defaults=require('lodash.defaults')
// var EventEmitter=require('events').EventEmitter
var util=require('util')
var JSONF=require('../../../../modules/jsonf')
var m=require('mithril')
var Ws4ever=require('../../../../modules/ws4ever')

var CommandList = require('../../../command-list')
var CMD_TYPES=require('../../../command').TYPES

// TODO better require
var MESSAGES=require('../../../../modules/browser-puppeteer/src/messages.js')

var EOL = '\n'

var JSON_OUTPUT_FORMATTER_NAME = 'json (built-in)'
var NOSTROMO_OUTPUT_FORMATTER_NAME = 'nostromo (built-in)'
var DEFAULT_OUTPUT_FILENAME = 'output'

window.RecorderApp=RecorderApp

// TODO beforeCommand: provide raw data AND next command as param
// TODO support touch events

// TODO executable specifications
// TODO play macro step-by-step

function RecorderApp(conf){
    var self = this

    if (typeof conf === 'string'){
        conf=JSONF.parse(conf)
    }

    self._conf = defaults({}, conf, {
        pressKeyFilter: function (command) {
            return [13, 27].indexOf(command.keyCode) >= 0;
        },
        beforeCapture: noop,
        outputFormatters: [],
        selectedOutputFormatter: JSON_OUTPUT_FORMATTER_NAME
    })

    self._conf.outputFormatters.unshift(
        {
            name: JSON_OUTPUT_FORMATTER_NAME,
            filename: 'recorder_output.json',
            fn: jsonOutputFormatter
        },
        {
            name: NOSTROMO_OUTPUT_FORMATTER_NAME,
            filename: 'recorder_output.js',
            fn: renderTestfile
        }
    )

    self._log = new Loggr({
        logLevel: Loggr.LEVELS.ALL, // TODO logLevel
        namespace: 'MacroRecorder'
    })

    self._wsConn = null
    self.commandList = new CommandList()

    self._isRecording = false

    self.actions={
        toggleRecording:function(){self._isRecording=!self._isRecording},
        clearRecording:function(){self.commandList.clear()},
        addAssertion:function(){self.commandList.add({ type: CMD_TYPES.ASSERT })},
        downloadOutput:function(){
            var formatter = self._getSelectedOutputFormatter();
            var output=self._getFormattedOutput()
            var blob=new Blob([output], {type:'application/octet-stream'})
            var dlTarget=document.getElementById('download-target')
            var dlUrl=window.URL.createObjectURL(blob)

            dlTarget.href=dlUrl
            dlTarget.download=formatter.filename || DEFAULT_OUTPUT_FILENAME
            dlTarget.click()
        },
        selectOutputFormatter:function(event){
            self._conf.selectedOutputFormatter = event.target.value
        },
    }
}

// TODO promise, resolve when loaded
RecorderApp.prototype.start = function(){
    var self=this
    self._wsConn=new Ws4ever(location.origin.replace('http://','ws://'))

    self._wsConn.onmessage= function(e){
        var data=e.data

        try{
            data=JSONF.parse(data)

            switch(data.type){
                case MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE:
                    self.onSelectorBecameVisibleEvent(data)
                    break
                case MESSAGES.UPSTREAM.CAPTURED_EVENT:
                    self._onCapturedEvent(data.event)
                    break
                case MESSAGES.UPSTREAM.INSERT_ASSERTION:
                    if (self._isRecording) self.commandList.add({ type: CMD_TYPES.ASSERT })
                    break
                default: throw new Error('Unknown type'+data.type)
            }

            m.redraw()
        }
        catch(e){
            console.warn('message error: '+e)
        }
    }

    var MountComp={
        view: function () {
            return m(RootComp, { app: self, actions: self.actions })
        }
    }

    m.mount($('#mount')[0], MountComp)
}

RecorderApp.prototype._getSelectedOutputFormatter=function(){
    var self=this
    var filtered=self._conf.outputFormatters.filter(function (formatter) {
        return formatter.name===self._conf.selectedOutputFormatter
    })

    if (filtered.length!==1){
        return function(){return '(formatter "'+self._conf.selectedOutputFormatter+'" not found)'}
    }

    return filtered[0]
}

RecorderApp.prototype._getFormattedOutput=function(){
    return this._getSelectedOutputFormatter().fn(this.commandList.getList())
}

RecorderApp.prototype._onCapturedEvent=function(event){
    if (!this._isRecording) {
        return
    }

    var command

    switch(event.type){
        case 'input':
            command = this._getCommandFromInputEvent(event);
            break
        case 'keydown':
            command = this._getCommandFromKeydownEvent(event);
            break
        case 'scroll':
            command = this._getCommandFromScrollEvent(event);
            break
        case 'click':
            command = this._getCommandFromClickEvent(event);
            break
        case 'focus':
            command = this._getCommandFromFocusEvent(event);
            break
        case 'mouseover':
            command = this._getCommandFromMouseoverEvent(event);
            break
        default:
            console.error('Unknown event type: '+event.type+', event:',event)
            return
    }

    // TODO pass event AND command
    // type, target, $target, selector
    var beforeCaptureData = {
        event:event,
        type: event.type,
        target:event.target,
        selector: event.selector,
    }

    if (this._conf.beforeCapture(beforeCaptureData)===false){
        console.log('capture prevented in onBeforeCapture')
        return
    }

    if (command.type==='pressKey' && this._conf.pressKeyFilter(command,event) === false) {
        return
    }

    this.addCommand(command)
}

RecorderApp.prototype._getCommandFromInputEvent=function(event){
    return {
        type: 'setValue',
        $timestamp: event.$timestamp,
        selector: event.selector,
        value: event.value,
    }
}

RecorderApp.prototype._getCommandFromKeydownEvent=function(event){
    return {
        type: 'pressKey',
        $timestamp: event.$timestamp,
        selector: event.selector,
        keyCode: event.keyCode,
    }
}

RecorderApp.prototype._getCommandFromScrollEvent=function(event){
    return {
        type: 'scroll',
        $timestamp: event.$timestamp,
        selector: event.selector,
        scrollTop: event.target.scrollTop,
    }
}

RecorderApp.prototype._getCommandFromClickEvent=function(event){
    return {
        type: 'click',
        $timestamp: event.$timestamp,
        selector: event.selector,
        $fullSelectorPath: event.$fullSelectorPath,
    }
}

RecorderApp.prototype._getCommandFromFocusEvent=function(event){
    return {
        type: 'focus',
        $timestamp: event.$timestamp,
        selector: event.selector,
        $fullSelectorPath: event.$fullSelectorPath,
    }
}

RecorderApp.prototype._getCommandFromMouseoverEvent=function(event){
    return {
        type: 'mouseover',
        $timestamp: event.$timestamp,
        selector: event.selector,
    }
}

RecorderApp.prototype.addCommand=function(cmd){
    this.commandList.add(cmd)
}

RecorderApp.prototype.onSelectorBecameVisibleEvent=function(data){
    if (!this._isRecording)return

    var rule=null

    this._conf.onSelectorBecameVisible.forEach(function(sbvRule){
        if (sbvRule.selector===data.selector){
            rule=sbvRule
        }
    })

    if (!rule){
        console.error('SelectorBecameVisible rule not found for selector '+data.selector)
    }
    else {
        rule.listener(this)
    }
}

var RootComp={
    view: function (vnode) {
        var app=vnode.attrs.app
        var actions=vnode.attrs.actions

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

            <div class="content">
                <section>
                    <p class="flex-row">
                        Output format:
                        <select class="output-format-dropdown" onchange={ actions.selectOutputFormatter }>{
                            app._conf.outputFormatters.map(function (formatter) {
                                return <option
                                        selected={ formatter.name === app._conf.selectedOutputFormatter }
                                        value={ formatter.name }>
                                    { formatter.name }
                                </option>
                            })
                        }</select>
                    </p>
                </section>

                <section>
                    <pre class="output">{ app._getFormattedOutput() }</pre>
                </section>
            </div>

            <a href="#" id="download-target" class="hidden"></a>
        </main>
    }
}

// remove meta (keys starting with $)
function cleanCmd(cmd) {
    var o={}

    Object.keys(cmd).forEach(function (k) {
        if (k[0] !== '$') {
            o[k]=cmd[k]
        }
    })

    return o
}

function jsonOutputFormatter(cmds, indent) {
    indent = indent || '    '

    if (cmds.length===0){return '[]'}

    return '[' + EOL +
        cmds.map(function (cmd) {
            if (cmd.type===CMD_TYPES.COMPOSITE) {
                return indent + '{"type":"'+CMD_TYPES.COMPOSITE+'","commands":[' + EOL +
                    cmd.commands.map(function (subcmd){ return indent + indent + JSON.stringify(cleanCmd(subcmd)) }).join(','+EOL) + EOL +
                indent + ']}'
            }
            else {
                return indent + JSON.stringify(cleanCmd(cmd))
            }
        }).join(','+EOL) + EOL +
        ']' + EOL;
}

// TODO move to own file
function renderTestfile(cmds, indent){
    indent = indent || '    '

    var res= [
        '\'use strict\';',
        '',
        'exports = module.exports = function (test) {',
        indent + 'test(\'\', t => {',
    ]

    cmds.forEach(function(cmd, i){
        if (i===0) res.push(indent + indent + 'return '+renderCmd(cmd, indent))
        else res.push(indent + indent + '.then(() => '+renderCmd(cmd, indent)+')')
    })

    res.push(
        indent + '});',
        '};',
        ''
    )

    return res.join(EOL)
}

// TODO move to own file
function renderCmd(cmd, indent){
    switch(cmd.type){
        case 'setValue': return 't.setValue('+apos(cmd.selector)+', '+apos(cmd.value)+')'
        case 'pressKey': return 't.pressKey('+apos(cmd.selector)+', '+cmd.keyCode+')'
        case 'scroll': return 't.scroll('+apos(cmd.selector)+', '+cmd.scrollTop+')'
        case 'click': return 't.click('+apos(cmd.selector)+')'
        case 'waitForVisible': return 't.waitForVisible('+apos(cmd.selector)+')'
        case 'waitWhileVisible': return 't.waitWhileVisible('+apos(cmd.selector)+')'
        case 'focus': return 't.focus('+apos(cmd.selector)+')'
        case 'assert': return 't.assert()'

        case 'composite': return 't.composite(['+ EOL +
            cmd.commands.map(function (subcmd){ return indent + indent + indent + inspectObj(cleanCmd(subcmd)) }).join(','+EOL) + EOL +
        indent + indent + '])'

        case 'mouseover': return 't.mouseover('+apos(cmd.selector)+')'
        // case '': return 't.()'
        default:console.error('unknown cmd type ',cmd.type, cmd);return '<unknown>'
    }
}

function ellipsis(s,l){l=l||30; return s.length<=l?s:s.substr(0,l-3)+'...'}

function apos(s){return '\'' + String(s).replace(/'/g,'\\\'') + '\''}

function promiseWhile(condition, action) {
    return Promise.try(function () {
        if (!condition()) {
            return;
        }

        return action()
        .then(promiseWhile.bind(null, condition, action))
    })
}

function deepCopy(o){return JSONF.parse(JSONF.stringify(o))}

function capitalize(str){return str[0].toUpperCase + str.slice(1)}

function noop(){}

function nl2backslashnl(str){
    return str.replace(/\n/g, '\\n')
}

function inspectObj(o){
    return '{ ' + Object.keys(o).map(function(k){ return k+': '+inspectVal(o[k]) }).join(', ') + ' }'
}

function inspectVal(v){
    switch (typeof v) {
        case 'string':return "'"+v+"'"
        case 'boolean':return v?'true':'false'
        default:return v
    }
}
