'use strict'

var os=require('os')
var defaults=require('../../modules/shallow-defaults')

var TAP_VERSION = 13

var DIAGNOSTIC_MARK = '#'

var DEFAULT_MESSAGES = aliasedMap({
    'ok': 'should be truthy',
    'notOk, notok': 'should be falsy',
    'equal': 'should be equal',
    'notEqual, notequal': 'should\'t be equal',
    'deepEqual, deepequal': 'should be deep equal',
    'notDeepEqual, notdeepequal': 'shouldn\'t be deep equal',
    'throws': 'should throw',
    'doesNotThrow, doesnotthrow': 'shouldn\'t throw',
    'anonymous': '(unnamed assert)'
})

/*
fail
pass
skip
ok -------
notOk -------
equal -------
notEqual -------
deepEqual -------
notDeepEqual -------
throws -------
doesNotThrow -------
*/

exports = module.exports = TAPWriter

function TAPWriter(conf) {
    this._conf = defaults(conf, {
        eol: os.EOL,
        indent: '  ',
        outStream: process.stdout
    });

    this._testCount=null
    this._failCount=null

    Object.defineProperties(this, {
        testCount: {
            get: function () { return this._testCount }
        },
        passCount: {
            get: function () { return this._testCount - this._failCount }
        },
        failCount: {
            get: function () { return this._failCount }
        },
    })

    this.reset()
}

TAPWriter.TAP_VERSION = TAP_VERSION

TAPWriter._aliasedMap = aliasedMap

TAPWriter.prototype.reset=function(){
    this._testCount=0
    this._failCount=0
}

TAPWriter.prototype.version = function (version) {
    version = version === undefined ? TAPWriter.TAP_VERSION : version
    this._writeLn('TAP version ' + version)
}

TAPWriter.prototype.diagnostic = function (message) {
    this._writeLn(DIAGNOSTIC_MARK + ' ' + message)
}

// TODO ok/notOk: accept string too, use as message

// type, message
TAPWriter.prototype.ok =
TAPWriter.prototype.pass = function (data) {
    var msg = typeof data === 'string'
        ? data
        : data.message || DEFAULT_MESSAGES[data.type] || DEFAULT_MESSAGES.anonymous
    this._testCount++
    this._writeLn('ok ' + this._testCount + ' ' + msg)
}

// TODO use one failure-type function, show expected+actual if provided
// use ok/notOk pair or pass/fail pair

TAPWriter.prototype.notOk = function (description) {
    description = description || DEFAULT_MESSAGES.anonymous
    this._testCount++
    this._failCount++

    this._writeLn('not ok ' + this._testCount + ' ' + description)
}

// type, message, expected, actual
TAPWriter.prototype.fail = function (data) {
    var msg = data.message || DEFAULT_MESSAGES[data.type] || DEFAULT_MESSAGES.anonymous
    this._testCount++
    this._failCount++

    this._writeLn('not ok ' + this._testCount + ' ' + msg)
    this._writeLn('---', 1)
    this._writeLn('operator: ' + data.type, 2)
    this._writeLn('expected: ' + prettyPrint(data.expected), 2)
    this._writeLn('actual:   ' + prettyPrint(data.actual), 2)
    this._writeLn('...', 1)
}

TAPWriter.prototype.plan = function (testCount) {
    testCount = testCount === undefined ? this._testCount : testCount
    this._writeLn('1..' + testCount)
}

TAPWriter.prototype.bailout=function(reason){
    reason = reason ? ' '+reason : ''
    this._writeLn('Bail out!'+reason)
}

TAPWriter.prototype.comment=function(message){
    this._writeLn(message, 1)
}

TAPWriter.prototype._write=function(str, indentLvl){
    var indent = strtimes(this._conf.indent, indentLvl || 0)
    this._conf.outStream.write(indent + str)
}

TAPWriter.prototype._writeLn=function(str, indentLvl){
    this._write(str+this._conf.eol, indentLvl)
}









function strtimes(str, times) {
    if (times === 0) return ''
    var result=''
    for (var i=0;i<times;i++){
        result+=str
    }
    return result
}

function prettyPrint(val){
    if (typeof val==='string') return '"'+val+'"'

    try{return JSON.stringify(val)}
    catch(err){return String(val)}
}

/**
 * {
 *   'notOk, notok': '...'
 * }
 *
 * =>
 *
 * {
 *   notOk: '...',
 *   notok: '...'
 * }
 * 
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function aliasedMap(raw){
    var map={}
    Object.keys(raw).forEach(rawKey=>{
        var val = raw[rawKey]
        var keys = rawKey.split(/, */)
        keys.forEach(key=>{
            map[key]=val
        })
    })

    return map
}
