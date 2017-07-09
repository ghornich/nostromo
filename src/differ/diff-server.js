var Promise=require('bluebird')
var fs=require('fs')
var fsAsync=Promise.promisifyAll(fs)
var resolve=require('path').resolve
var http=require('http')
var urllib=require('url')
var qs=require('querystring')
var JSONF=require('jsonf')
var pngjs=require('pngjs')
var PNG=pngjs.PNG
var glob=require('glob')
var diffImages=require('buffer-image-diff')

exports=module.exports=DiffServer

function DiffServer(conf){
	this._conf=conf
	this._conf.port=this._conf.port||33561

	if (!this._conf.referenceScreenshotDirs){
		throw new Error('No referenceScreenshotDirs defined')
	}
	
	this._server = http.createServer(this._onHttpReq.bind(this))
}

DiffServer.prototype.start=function(){
	this._server.listen(this._conf.port)

	console.log('--- Open http://localhost:'+this._conf.port+' in your browser ---')
}

DiffServer.prototype._onHttpReq=function(req, resp){
	console.log('req to ' + req.url)

	if (req.url==='/'){
		resp.end(
			fs.readFileSync(resolve(__dirname,'web-app/src/diff.html'), { encoding: 'utf-8' })
			.replace('[[CONFIG]]', JSONF.stringify(this._conf).replace(/'/g, '\\\''))
		)
	}
	else if (req.url==='/script.js'){
		resp.end(fs.readFileSync(resolve(__dirname,'../../dist/diff-app.dist.js')), { encoding: 'utf-8' })
	}
	/*
	else if (req.url==='') {

	}
	*/
	else if (req.url==='/get-diffs') {
		resp.setHeader('content-type', 'application/json')
		resp.end(JSON.stringify(this.getDiffableScreenshots()))
	}
	else if (req.url==='') {

	}
	else {
		resp.status=404
		resp.end('404')
	}
}

DiffServer.prototype.getDiffableScreenshots=function(){
	var failPaths = []

	this._conf.referenceScreenshotDirs.forEach(dir=>{
		var paths=glob.sync(dir + '/**/*FAIL.png')
		failPaths=failPaths.concat(paths)
	})

	var refPaths=[]

	failPaths.forEach(p=>{
		refPaths.push(p.replace('.FAIL', ''))
	})

	// TODO limit concurrent fs operations
	// TODO async code

	var diffs=refPaths.map(function(refP, i){
		var failP=failPaths[i]

		var refRawImg=fs.readFileSync(refP)
		var failRawImg=fs.readFileSync(failP)

		var refImg=PNG.sync.read(refRawImg)
		var failImg=PNG.sync.read(failRawImg)

		var diffBounds = diffImages(refImg, failImg, {groupingThreshold: 100, padding: 0})

		return {
			refPath:refP,
			failPath:failP,
			count: refP.match(/\/(\d+)/)[1],
			dir: refP.replace(/\/[^\/]+$/, ''),
			diffBounds:diffBounds,
			refImg: {
				width: refImg.width,
				height: refImg.height,
				base64: new Buffer(refRawImg).toString('base64')
			},
			failImg: {
				width: failImg.width,
				height: failImg.height,
				base64: new Buffer(failRawImg).toString('base64')
			},
		}
	})

	return diffs
}

