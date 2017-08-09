const assert=require('assert')
var rfr=require('rfr')
var Promise=require('bluebird')
var fs=require('fs')
var fsAsync=Promise.promisifyAll(fs)
var resolve=require('path').resolve
var pathlib=require('path')
var http=require('http')
var urllib=require('url')
var qs=require('querystring')
var JSONF=rfr('modules/jsonf')
var pngjs=require('pngjs')
var PNG=pngjs.PNG
var glob=require('glob')
var visualImgDiff=rfr('modules/buffer-image-visual-diff')
const mkdirpAsync=Promise.promisify(require('mkdirp'))
const globAsync=Promise.promisify(require('glob'))

exports=module.exports=DiffServer

function DiffServer(conf){
	this._conf=conf
	this._conf.port=this._conf.port||33561

	if (!this._conf.referenceScreenshotsDir){
		throw new Error('No referenceScreenshotsDir defined')
	}

	if (!this._conf.referenceErrorsDir){
		throw new Error('No referenceErrorsDir defined')
	}

	this._diffTempFolder='_diff_temp'

	this._diffDescriptors=[]

	this._server = http.createServer(this._onHttpReq.bind(this))
}

DiffServer.prototype.start=async function(){
	console.log('Generating diff image cache...')
	await this._generateDiffCache()
	this._server.listen(this._conf.port)
	console.log('--- Open http://localhost:'+this._conf.port+' in your browser ---')
}

DiffServer.prototype._generateDiffCache=async function(){
	const refErrorPaths=await globAsync(pathlib.join(this._conf.referenceErrorsDir, '**','*.png'))

	const refScreenshotPaths = refErrorPaths.map(p=>p.replace(this._conf.referenceErrorsDir, this._conf.referenceScreenshotsDir))

	await mkdirpAsync(this._diffTempFolder)

	for (const [i, refErrorPath] of refErrorPaths.entries()) {
		const refScreenshotPath=refScreenshotPaths[i]
		// const errorImgBuf=PNG.sync.read(fs.readFileSync(refErrorPath))
		// const refImgBuf=PNG.sync.read(fs.readFileSync(refScreenshotPath))
		// const diffResult = visualImgDiff(refImgBuf, errorImgBuf, { pixelThreshold: 1/100 })
		const diffFilename = refScreenshotPath.replace(this._conf.referenceScreenshotsDir, '').replace(/[\\\/]/g, '_')

		const diffDescriptor = new DiffDescriptor({
			id: diffFilename,
			refPath: resolve(refScreenshotPath),
			errPath: resolve(refErrorPath),
			diffPath: resolve(this._diffTempFolder, diffFilename)
		})

		this._diffDescriptors.push(diffDescriptor)

		// fs.writeFileSync(resolve(this._diffTempFolder, diffFilename), PNG.sync.write(diffResult))
	}
}

DiffServer.prototype._onHttpReq=function(req, resp){
	var parsedUrl=urllib.parse(req.url)
	var query = qs.parse(parsedUrl.query)
	var pathname = parsedUrl.pathname

	if (pathname==='/'){
		resp.end(
			fs.readFileSync(resolve(__dirname,'web-app/src/diff.html'), { encoding: 'utf-8' })
			.replace('[[CONFIG]]', JSONF.stringify(this._conf).replace(/'/g, '\\\''))
		)
	}
	else if (pathname==='/script.js'){
		resp.end(fs.readFileSync(resolve(__dirname,'../../dist/diff-app.dist.js')), { encoding: 'utf-8' })
	}
	else if (pathname==='/get-diff-descriptors') {
		resp.setHeader('content-type', 'application/json')
		resp.end(JSON.stringify(this._diffDescriptors))
	}
	else if (pathname==='/get-diff-images-by-id') {
		resp.setHeader('content-type', 'application/json')
		let diffDescriptor = this._diffDescriptors.filter(dd=>dd.id===query.id)

		if (!diffDescriptor || diffDescriptor.length===0) {
			resp.status=404
			resp.end(JSON.stringify({error:'id not found'}))
		}

		diffDescriptor=diffDescriptor[0]

		try {
			const refImgBase64=Buffer.from(fs.readFileSync(diffDescriptor.refPath)).toString('base64')
			const errImgBase64=Buffer.from(fs.readFileSync(diffDescriptor.errPath)).toString('base64')
			const diffImgBase64=Buffer.from(fs.readFileSync(diffDescriptor.diffPath)).toString('base64')

			resp.end(JSON.stringify({
				refImg: refImgBase64,
				errImg: errImgBase64,
				diffImg: diffImgBase64
			}))
		}
		catch (err) {
			resp.status=404
			resp.end(JSON.stringify({error:err.message}))
		}
	}
	else {
		resp.status=404
		resp.end('404')
	}
}

DiffServer.prototype.getDiffableScreenshots=function(){
	var failPaths = []

	this._conf.referenceScreenshotsDir.forEach(dir=>{
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

// id, refPath, errPath, diffPath
function DiffDescriptor(data){
	this.id = data.id
	this.refPath = data.refPath
	this.errPath = data.errPath
	this.diffPath = data.diffPath
}
