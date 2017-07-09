const Promise=require('bluebird')
Promise.config({ longStackTraces: true })
const Loggr=require('loggr')
const defaults=require('defaults')
const Schema=require('schema-inspector')
const http=require('http')
const fs=require('fs')
const pathlib=require('path')
const util = require('util')
const TapWriter=require('tap-writer')
const EventEmitter=require('events').EventEmitter
const BrowserPuppeteer=require('browser-puppeteer').BrowserPuppeteer
const MESSAGES=require('browser-puppeteer').MESSAGES
const cropMarkerImg=require('browser-puppeteer').SCREENSHOT_MARKER
const screenshotjs=require('screenshot-js')
const mkdirpAsync=Promise.promisify(require('mkdirp'))
const PNG=require('pngjs').PNG
const globAsync=Promise.promisify(require('glob'))

// TODO show error if test(...) doesn't return a promise

const CONF_SCHEMA = {
    type: 'object',
    properties: {
        appUrl: {
            type: 'string',
            pattern: /^(http:\/\/|file:\/\/\/)[^ ]+$/ // TODO support relative file:/// urls
        },
        testPort: {
            type: 'number',
            optional: true
        },
        testFiles: {
            type: ['string', 'array']
        },
        browsers: {
            type: ['function', 'array']
        },
        logLevel: {
            type: 'number',
            optional:true
        },
        bailout: {
            type:'boolean',
            optional: true
        }
        // TODO "autoclose": close browser and test server when tests complete - default: true
        //      if false, wait for browser to close



    }
}

const DEFAULT_TEST_PORT = 47225
const DEFAULT_WAITXVISIBLE_TIMEOUT = 5000

const ELLIPSIS_LIMIT = 60

// TODO customizable dir for different screen resolution tests
const REF_SCREENSHOT_BASE_DIR = 'referenceScreenshots'

const ERRORS = {
    TIMEOUT: 0,
    NOT_EQUAL: 1,
}

exports = module.exports = TestRunner

function TestRunner(conf){
    EventEmitter.call(this)

    this._conf=defaults(conf, {
        testPort: DEFAULT_TEST_PORT,
        waitForConnectionTimeout: 5000,
        logLevel: 0,//Loggr.LEVELS.INFO,
        bailout: true,
        keepalive: false,
        referenceScreenshotDir: REF_SCREENSHOT_BASE_DIR,
        beforeTest: noop,
        afterTest: noop,
    })

    this._log=new Loggr({
        level: 100,//this._conf.logLevel,
        showTime:true,
        namespace:'TestRunner',
        outStream: {
            write: function (str) {
                process.stdout.write('  ' + str)
            }
        }
    })


    this._beforeCommand = null
    this._afterCommand = null

    this._tapWriter = new TapWriter()

    // -------------------

    // TODO ensure browser names are unique (for reference images)

    var validationResult = Schema.validate(CONF_SCHEMA, this._conf)

    if (!validationResult.valid){
        this._log.debug('conf validation failed')
        throw new Error(validationResult.format())
    }

    // -------------------

    if (!__isArray(this._conf.testFiles)){
        this._conf.testFiles=[this._conf.testFiles]
    }


    if (!__isArray(this._conf.browsers)){
        this._conf.browsers=[this._conf.browsers]
    }

    this._httpServer=null

    // '_execFn,equal,click,setValue,waitForVisible,waitWhileVisible'.split(',').forEach(fnn=>{
    //     this[fnn]=this[fnn].bind(this)
    // })

    this.directAPI={
        getValue: this._getValue_direct.bind(this),
        setValue: this._setValue_direct.bind(this),
        click: this._click_direct.bind(this),
        waitForVisible: this._waitForVisible_direct.bind(this),
        waitWhileVisible: this._waitWhileVisible_direct.bind(this),
        focus: this._focus_direct.bind(this),
        scroll: this._scroll_direct.bind(this),
        isVisible: this._isVisible_direct.bind(this),
        delay:this._delay.bind(this),
        comment:this._comment.bind(this),
        assertScreenshot:this._assertScreenshot.bind(this)
    }

    this.sideEffectAPI={}

    Object.keys(this.directAPI).forEach(key=>{
        if (/delay|comment/.test(key))return
        var directAPIFn=this.directAPI[key]
        this.sideEffectAPI[key] = this._wrapFunctionWithSideEffects(directAPIFn, key)
    })

    this.sideEffectAPI.delay=this.directAPI.delay
    this.sideEffectAPI.comment=this.directAPI.comment

    this.directAPI.execCommands=this._execCommands_direct.bind(this)
    this.sideEffectAPI.execCommands=this._execCommands_sideEffect.bind(this)

    this._browserPuppeteer=new BrowserPuppeteer({
        logger: this._log.fork('BrowserPuppeteer')
    })

    this._screenshotAssertCount = 0
    this._currentTestfilePath=null
    this._currentBrowserName=null

    this._log.trace('instance created')
}

util.inherits(TestRunner,EventEmitter)

TestRunner.prototype.run = Promise.method(function(){
    this._log.debug('running...')
    this._log.trace('input test files: ', this._conf.testFiles)

    var testFilePaths = []

    return multiGlobAsync(this._conf.testFiles)
    .then((paths)=>{
        if (paths.length===0){
            throw new Error('No testfiles found')
        }

        testFilePaths=paths
    })

    .then(()=>this._startServers())

    .then(() => {
        return Promise.each(this._conf.browsers, browser=>{
            this._currentBrowserName = browser.name

            // TODO beforeBrowser, afterBrowser

            return Promise.try(_=>browser.start(this._conf.appUrl))
            .then(()=>this._browserPuppeteer.discardClients())
            .then(()=>this._screenshotAssertCount=0)
            .then(()=>this._browserPuppeteer.waitForPuppet())
            .then(() => this._browserPuppeteer.sendMessage({
                type: MESSAGES.DOWNSTREAM.SHOW_SCREENSHOT_MARKER
            }))
            .then(() => this._runTestFiles(testFilePaths))
            .catch(err => {
                // TODO better error handling
                console.error(err)
                console.error(err.stack)
            })
            .finally(()=>{
                this._tapWriter.diagnostic('tests ' + this._tapWriter.testCount)
                this._tapWriter.diagnostic('pass ' + this._tapWriter.passCount)
                this._tapWriter.diagnostic('fail ' + this._tapWriter.failCount)

                // TODO optionally keep browser open for debugging (detach process & exit? OR wait for manual closing?)
                if (!this._conf.keepalive) {
                    return browser.stop()
                }
            })
        })
        .then(()=>this._stopServers())
        .catch(err => {
            // TODO better error handling
            console.error(err)
            console.error(err.stack)
        })
    })
    .catch(error => {
        this._log('ERROR: '+error.toString())
    })
})

TestRunner.prototype._startServers = Promise.method(function(){
    var self=this

    self._log.trace('_startServers called')

    self._browserPuppeteer.start()

    // return new Promise((res,rej)=>{
    //     self._httpServer = http.createServer(self._onHttpRequest.bind(self))

    //     self._httpServer.listen(self._conf.testPort, res)

    // })
})

TestRunner.prototype._stopServers = function(){
    // this._httpServer.close()
    this._browserPuppeteer.stop()
},

TestRunner.prototype._runTestFiles = function(testFilePaths){
    var testCount = 0

    this._tapWriter.version()

    return mkdirpAsync(this._getCurrentBrowserReferenceScreenshotDir())
    .then(() => {
        return Promise.each(testFilePaths, path => {
            this._currentTestfilePath=path
            var absPath = pathlib.resolve(path)
            this._log.debug(`Requiring testFile "${path}"`)
            var testModule = require(absPath)

            return this._runTestModule(testModule)
        })
    })
    .then(() => this._tapWriter.plan())
    .catch(err=>{
        if (err.type==='BailoutError') {
            console.log(err.stack)
            this._tapWriter.bailout(err.message)
        }
        else {
            console.log('_runTestFiles err:',err)
        }
    })
},

TestRunner.prototype._getCurrentBrowserReferenceScreenshotDir = function(){
    return pathlib.resolve(REF_SCREENSHOT_BASE_DIR, this._currentBrowserName)
},

TestRunner.prototype._getCurrentTestModuleReferenceScreenshotDir = function(){
    var testfilePathSlug = slugifyPath(this._currentTestfilePath)

    return pathlib.resolve(this._getCurrentBrowserReferenceScreenshotDir(), testfilePathSlug)
},

TestRunner.prototype._runTestModule = function(fn){
    this._log.trace('_runTestModule')

    return mkdirpAsync(this._getCurrentTestModuleReferenceScreenshotDir())
    .then(()=>{
        var testDatas = []

        function testRegistrar(name, testFn) { // TODO optional name
            testDatas.push({name:name,testFn:testFn})
        }

        testRegistrar.Promise=Promise

        fn(testRegistrar)

        // TODO show before/after commands in logging
        this._beforeCommand = testRegistrar.beforeCommand || this._conf.defaultBeforeCommand || noop
        this._afterCommand = testRegistrar.afterCommand || this._conf.defaultAfterCommand || noop

        return Promise.each(testDatas, testData => {
            this._tapWriter.diagnostic(testData.name)
            this._log.debug('Running test: ' + (testData.name || '(anonymous)'))

            return Promise.try(this._conf.beforeTest)
            .then(()=>{
                var maybePromise = testData.testFn(this.sideEffectAPI)

                if (typeof maybePromise.then !== 'function'){
                    throw new Error('test function didn\'t return a promise (name: '+testData.name+')')
                }

                return maybePromise
            })
            .then(this._conf.afterTest)
            
        })
    })
},

// TODO add next/prev command as param in before/after calls
TestRunner.prototype._wrapFunctionWithSideEffects = function(fn, cmdType){
    return (...args)=>{
        return Promise.try(_=>this._beforeCommand(this.directAPI, {type:cmdType}))
        .then(_=>fn(...args))
        .then(_=>this._afterCommand(this.directAPI, {type:cmdType}))
    }
},

TestRunner.prototype._execCommand_withAPI = Promise.method(function(cmd, api){
    switch(cmd.type){
        case 'setValue': return api.setValue(cmd.selector, cmd.value)
        case 'click': return api.click(cmd.selector)
        case 'waitForVisible': return api.waitForVisible(cmd.selector)
        case 'waitWhileVisible': return api.waitWhileVisible(cmd.selector)
        case 'focus': return api.focus(cmd.selector)
        case 'assertScreenshot': return api.assertScreenshot()
        // case 'scroll': return api.()
        case 'isVisible': return api.isVisible(cmd.selector)
        default: throw new Error('Unknown cmd.type '+cmd.type)
    }
})

TestRunner.prototype._execCommand_direct = Promise.method(function(cmd){
    return this._execCommand_withAPI(cmd, this.directAPI)
})

TestRunner.prototype._execCommand_sideEffect = Promise.method(function(cmd){
    return this._execCommand_withAPI(cmd, this.sideEffectAPI)
})

TestRunner.prototype._execCommands_direct = Promise.method(function(cmds){
    return Promise.each(cmds,cmd=>this._execCommand_direct(cmd))
})

TestRunner.prototype._execCommands_sideEffect = Promise.method(function(cmds){
    return Promise.each(cmds,cmd=>this._execCommand_sideEffect(cmd))
})

TestRunner.prototype._equal_direct = Promise.method(function(selector, expected, description) {
    description=description||'equal - ' + selector + ', ' + expected

    return this._getValue(selector)
    .then(actual=>{
        if (expected === actual) {
            this._tapWriter.pass({type:'equal',message:description})
        }
        else {
            var err=new Error('not equal')
            err.type=ERRORS.NOT_EQUAL
            err.expected=expected
            err.actual=actual
            err.description=description
            throw err
        }
    })
    .catch(err=>{
        /*errors:
        selector not found
        selector not unique
        not equal
        timeout?
        */
       
        if (err.type===ERRORS.NOT_EQUAL) {
            this._tapWriter.fail({
                type:'equal',
                expected:err.expected,
                actual:err.actual
            })
        }
        else {
            this._tapWriter.notOk(err.message)
        }

        if (this._conf.bailout) {
            throw createError('BailoutError', err.message)
        }
    })  
})

TestRunner.prototype._isEqual_direct = Promise.method(function (selector, expected, description) {
    return this._getValue(selector)
    .then(actual=>expected === actual)
    .catch(err=>this._tapWriter.notOk(err.message))
})

TestRunner.prototype._click_direct = Promise.method(function (selector, description) {
    description=description||'click - ' + selector

    return this._browserPuppeteer.execCommand({
        type: 'click',
        selector: selector
    })
    .then(()=> {
        this._tapWriter.pass({type:'click',message:description})
    })
    .catch(e=>{
        this._tapWriter.notOk(e.message)

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message)
        }
    })
})

TestRunner.prototype._getValue = Promise.method(function(selector){
    return this._browserPuppeteer.execCommand({
        type: 'getValue',
        selector: selector
    })
})

TestRunner.prototype._getValue_direct = Promise.method(function(selector){
    // TODO logging?
    return this._browserPuppeteer.execCommand({
        type: 'getValue',
        selector: selector
    })
})

TestRunner.prototype._setValue_direct = Promise.method(function (selector, value, description) {
    // TODO logging?
    description=description||'setValue - ' + selector + ', ' + value

    return this._browserPuppeteer.execCommand({
        type: 'setValue',
        selector: selector,
        value: value
    })
    .then(()=>{
        this._tapWriter.pass({type:'setValue',message:description})
    })
    .catch(e=>{
        this._tapWriter.notOk(e.message)

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message)
        }
    })
})

TestRunner.prototype._pressKey_direct = Promise.method(function (selector, keyCode, description) {
   throw new Error('TODO _pressKey_direct') 
})

TestRunner.prototype._waitForVisible_direct = Promise.method(function (selector, timeout) {
    this._log.info('waitForVisible: '+ellipsis(selector,ELLIPSIS_LIMIT))

    return this._browserPuppeteer.execCommand({
        type: 'waitForVisible',
        selector: selector
    })
    // TODO
    // TODO don't use Promise timeouts
    // .timeout(timeout || DEFAULT_WAITXVISIBLE_TIMEOUT)
    .catch(e=>{
        this._tapWriter.notOk({ type: 'waitForVisible', message: e.message })

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message)
        }
    })
})

TestRunner.prototype._waitWhileVisible_direct = Promise.method(function (selector) {
    this._log.info('waitWhileVisible: '+ellipsis(selector,ELLIPSIS_LIMIT))

    return this._browserPuppeteer.execCommand({
        type: 'waitWhileVisible',
        selector: selector
    })
    .catch(e=>{
        this._tapWriter.notOk({ type: 'waitWhileVisible', message: e.message })

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message)
        }
    })
})

TestRunner.prototype._focus_direct = Promise.method(function (selector, description) {
    throw new Error('TODO _focus_direct')
})

TestRunner.prototype._scroll_direct = Promise.method(function(selector, scrollTop) {
    this._log.info('scroll: '+selector)

    return this._browserPuppeteer.execCommand({
        type: 'scroll',
        selector: selector,
        scrollTop: scrollTop
    })
    .catch(e=>{
        this._tapWriter.notOk({ type: 'scroll', message: e.message })

        if (this._conf.bailout) {
            throw createError('BailoutError', e.message)
        }
    })
})

TestRunner.prototype._isVisible_direct = Promise.method(function (selector, description) {
   throw new Error('TODO _isVisible_direct') 
})

TestRunner.prototype._delay = Promise.method(function (ms, description) {
    this._log.info('delay '+ms)
    return Promise.delay(ms)
})

TestRunner.prototype._comment = Promise.method(function (comment) {
    this._tapWriter.comment(comment)
})

// TODO remove sync codes
TestRunner.prototype._assertScreenshot = Promise.method(function(){
    var ssCount = this._screenshotAssertCount
    var refImgDir = this._getCurrentTestModuleReferenceScreenshotDir()
    var refImgName = ssCount+'.png'
    var refImgPath = pathlib.resolve(refImgDir, refImgName)
    var refImgPathRelative = pathlib.relative(pathlib.resolve(REF_SCREENSHOT_BASE_DIR), refImgPath)

    return screenshotjs({ cropMarker: cropMarkerImg })
    .then(img=>{
        try {
            fs.statSync(refImgPath)
            var refImg = PNG.sync.read(fs.readFileSync(refImgPath))
            if (imgcmp(img, refImg)) {
                this._tapWriter.ok('screenshot assert: '+refImgPathRelative) // TODO customizable message
            }
            else {
                // TODO save image for later comparison
                this._tapWriter.notOk('screenshot assert: '+refImgPathRelative) // TODO customizable message
                
                var failedImgName = ssCount + '.FAIL.png'
                var failedImgPath = pathlib.resolve(refImgDir, failedImgName)
                var failedImgPathRelative = pathlib.relative(pathlib.resolve(REF_SCREENSHOT_BASE_DIR), failedImgPath)

                var failedPng = new PNG(img)
                failedPng.data=img.data
                var failedImgBin = PNG.sync.write(failedPng)

                fs.writeFileSync(failedImgPath, failedImgBin)

                this._log.info('failed screenshot added: ' + failedImgPathRelative)
            }
        }
        catch(e){
            if (e.code === 'ENOENT') {
                var png = new PNG(img)
                png.data=img.data
                var pngFileBin = PNG.sync.write(png)

                fs.writeFileSync(refImgPath, pngFileBin)

                this._log.info('new reference image added: ' + refImgPathRelative)
            }
            else {
                throw e
            }
        }
    })
    .catch(e=>{
        this._tapWriter.notOk('screenshot assert: '+refImgName + ', '+ e) // TODO customizable message
    })
    .finally(_=>{
        this._screenshotAssertCount++
    })
})

function noop(){}

function __toString(v){return Object.prototype.toString.call(v)}
function __isArray(v){return __toString(v)==='[object Array]'}

function createError(type,msg){var e=new Error(msg);e.type=type;return e}

const PX_COLOR_DIFF_THRES = 3/100

function imgcmp(a,b){
    // TODO provide a reason for failure? move to separate module
    if (a.width!==b.width || a.height !== b.height)return false
    if (a.data.equals(b.data))return true
    if (a.data.length !== b.data.length)return false

    for (var i=0,len=a.data.length;i<len;i++){
        if (a.data[i] === b.data[i])continue
        var diffPc = (a.data[i] - b.data[i])/b.data[i]
        if (diffPc<0)diffPc=-diffPc
        if (diffPc > PX_COLOR_DIFF_THRES) {
            return false
        }
    }
}

function slugifyPath(s){return s.replace(/[\/\\]+/g, '___').replace(/[^a-z0-9_-]/ig, '_')}

function ellipsis(s,l){if (s.length<=l)return s;return s.substr(0,l-3)+'...'}

function multiGlobAsync(globs){
    var paths=[]

    return Promise.each(globs, glob => {
        return globAsync(glob)
        .then(results => {
            paths=paths.concat(results)
        })
    })
    .then(()=>paths)
}
