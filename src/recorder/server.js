var MODULES_PATH='../../modules/'
var Promise=require('bluebird')
var BrowserPuppeteer=require(MODULES_PATH + 'browser-puppeteer').BrowserPuppeteer
var MESSAGES=require(MODULES_PATH + 'browser-puppeteer').MESSAGES
var WS=require('ws')
var http=require('http')
var fs=require('fs')
var JSONF=require(MODULES_PATH + 'jsonf')
var pathlib=require('path')
var Loggr=require(MODULES_PATH + 'loggr')

module.exports=Server

function Server(conf){
	this._conf=conf

    this._conf.beforeCapture=this._conf.beforeCapture||noop

	this._recServer=http.createServer(this._onRecRequest.bind(this))
	this._wsServer=new WS.Server({server:this._recServer})

    this._log=new Loggr({
        namespace: 'RecorderServer',
        logLevel: this._conf.logLevel
    })

    this._puppeteer=new BrowserPuppeteer({
        logger: this._log.fork('BrowserPuppeteer')
    })

    this._proxyMessage=this._proxyMessage.bind(this)
}

// TODO better promise chain?
Server.prototype.start=Promise.method(function(){
    this._wsServer.on('connection',()=>this._log.info('recorder app connected'))

	this._recServer.listen(this._conf.recorderAppPort)
    this._puppeteer.start()

    console.log('--- Open the recording app in your browser: http://localhost:'+this._conf.recorderAppPort+' ---')
    // TODO add "open the tested app" text

	this._puppeteer.on(MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, this._proxyMessage)
    this._puppeteer.on(MESSAGES.UPSTREAM.CAPTURED_EVENT, this._proxyMessage)
	this._puppeteer.on(MESSAGES.UPSTREAM.INSERT_ASSERTION, this._proxyMessage)

    this._puppeteer.on('puppetConnected', ()=>{
        // no return
        this._puppeteer.setTransmitEvents(true)
        .then(()=>{
            var selectors = (this._conf.onSelectorBecameVisible || []).map(data => data.selector)

            if (selectors.length > 0) {
                return this._puppeteer.setSelectorBecameVisibleSelectors(selectors)
            }
        })
    })
})

Server.prototype._proxyMessage=function (data, rawData) {
    if (this._wsServer.clients.size === 1) {
    	this._wsServer.clients.forEach(wsConn=>wsConn.send(rawData))
    }
    else {
    	this._log.debug('_proxyMessage warning: invalid recording app connection count: '+this._wsServer.clients.size)
    }
}

Server.prototype._onRecRequest=function(req,resp){
	if (req.url==='/'){
        resp.end(
            fs.readFileSync(pathlib.resolve(__dirname, 'ui/recorder-ui.html'), { encoding: 'utf-8' })
            .replace('[[CONFIG]]', JSONF.stringify(this._conf).replace(/\\/g, '\\\\').replace(/'/g, "\\'"))
        )
    }
    else if (req.url==='/script.js') {
        resp.end(fs.readFileSync(pathlib.resolve(__dirname, '../../dist/recorder-app.dist.js'), { encoding: 'utf-8' }))
    }
    else {
        resp.status=404
        resp.end('Not found')
    }
}

/*Server.prototype.=function(){

}*/

/*Server.prototype.=function(){

}*/


function noop(){}
