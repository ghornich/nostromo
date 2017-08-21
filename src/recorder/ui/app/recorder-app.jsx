var _=require('lodash')
var $=require('jquery')
var Promise=require('bluebird')
// var css=require('./src/styles/index.styl')
// var views=require('./views.msx')
// var utils = require('./utils')
var Loggr = require('../../../../modules/loggr')
var defaults=require('../../../../modules/shallow-defaults')
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

var NOSTROMO_TESTFILE_FORMATTER_NAME = 'nostromo (js)'

window.RecorderApp=RecorderApp

// TODO record command times, compare to tested times?

// TODO handle if connection was lost?

// TODO beforeCommand: provide raw data AND next command as param
// TODO support touch events

// TODO executable specifications
// TODO play macro step-by-step

function RecorderApp(conf){
    var self = this

    if (typeof conf === 'string'){
        conf=JSONF.parse(conf)
    }

    self._conf = conf||{}

    self._conf.pressKeyFilter=self._conf.pressKeyFilter||function (command) {
        return [13, 27].indexOf(command.keyCode) >= 0;
    }

    self._conf.beforeCapture = self._conf.beforeCapture||noop

    self._conf.testfileRenderers=self._conf.testfileRenderers||[]

    self._conf.outputFormatters.unshift({
        name: NOSTROMO_TESTFILE_FORMATTER_NAME,
        fn: renderTestfile
    })

    self._selectedOutputFormatter = self._conf.selectedOutputFormatter || NOSTROMO_TESTFILE_FORMATTER_NAME

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
        downloadTestfile:function(){
            var output=self._getFormattedOutput()
            var blob=new Blob([output], {type:'application/octet-stream'})
            var dlTarget=document.getElementById('download-target')
            var dlUrl=window.URL.createObjectURL(blob)
            dlTarget.href=dlUrl
            dlTarget.download='output.js'
            dlTarget.click()
        },
        selectOutputFormatter:function(event){
            self._selectedOutputFormatter = event.target.value
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
        return formatter.name===self._selectedOutputFormatter
    })

    if (filtered.length!==1){
        return function(){return '(formatter "'+self._selectedOutputFormatter+'" not found)'}
    }

    return filtered[0]
}

RecorderApp.prototype._getFormattedOutput=function(){
    return self._getSelectedOutputFormatter()
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
        timestamp: event.timestamp,
        selector: event.selector,
        value: event.value,
    }
}

RecorderApp.prototype._getCommandFromKeydownEvent=function(event){
    return {
        type: 'pressKey',
        timestamp: event.timestamp,
        selector: event.selector,
        keyCode: event.keyCode,
    }
}

RecorderApp.prototype._getCommandFromScrollEvent=function(event){
    return {
        type: 'scroll',
        timestamp: event.timestamp,
        selector: event.selector,
        scrollTop: event.target.scrollTop,
    }
}

RecorderApp.prototype._getCommandFromClickEvent=function(event){
    return {
        type: 'click',
        timestamp: event.timestamp,
        selector: event.selector,
    }
}

RecorderApp.prototype._getCommandFromFocusEvent=function(event){
    return {
        type: 'focus',
        timestamp: event.timestamp,
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

        return <div>
            <button onclick={ actions.toggleRecording }>Toggle recording</button>&nbsp;
            <button onclick={ actions.clearRecording }>Clear recording</button>&nbsp;
            <button onclick={ actions.addAssertion }>Add assertion</button>&nbsp;
            <button onclick={ actions.downloadTestfile }>Download testfile</button>&nbsp;
            | { app._isRecording ? 'Recording': 'Not recording' }
            <div>
                <div>Output format:
                    <select onchange={ actions.selectOutputFormatter }>{
                        app._conf.outputFormatters.map(function (formatter) {
                            return <option
                                    selected={ formatter.name === outputFormatter.name }
                                    value={ formatter.name }>
                                { formatter.name }
                            </option>
                        })
                    }</select>
                </div>
                <pre>{ app._getFormattedOutput() }</pre>
            </div>

            <a href="#" id="download-target" class="hidden"></a>
        </div>
    }
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
        if (i===0) res.push(indent + indent + 'return '+renderCmd(cmd))
        else res.push(indent + indent + '.then(() => '+renderCmd(cmd)+')')
    })

    res.push(
        indent + '});',
        '};',
        ''
    )

    return res.join(EOL)
}

// TODO move to own file
function renderCmd(cmd){
    switch(cmd.type){
        case 'setValue': return 't.setValue('+apos(cmd.selector)+', '+apos(cmd.value)+')'
        case 'pressKey': return 't.pressKey('+apos(cmd.selector)+', '+cmd.keyCode+')'
        case 'scroll': return 't.scroll('+apos(cmd.selector)+', '+cmd.scrollTop+')'
        case 'click': return 't.click('+apos(cmd.selector)+')'
        case 'waitForVisible': return 't.waitForVisible('+apos(cmd.selector)+')'
        case 'waitWhileVisible': return 't.waitWhileVisible('+apos(cmd.selector)+')'
        case 'focus': return 't.focus('+apos(cmd.selector)+')'
        case 'assert': return 't.assert()'
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
