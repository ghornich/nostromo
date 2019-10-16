const MODULES_PATH = '../../modules/';
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const resolve = require('path').resolve;
const pathlib = require('path');
const http = require('http');
const urllib = require('url');
const qs = require('querystring');
const JSONF = require(MODULES_PATH + 'jsonf');
const pngjs = require('pngjs');
const PNG = pngjs.PNG; // TODO deprecated
const glob = require('glob');
// const visualImgDiff = require(MODULES_PATH + 'buffer-image-visual-diff');
const mkdirpAsync = Promise.promisify(require('mkdirp'));
const globAsync = Promise.promisify(require('glob'));

exports = module.exports = DiffServer;

function DiffServer(conf) {
    this._conf = conf;
    this._conf.port = this._conf.port || 33561;

    if (!this._conf.referenceScreenshotsDir) {
        throw new Error('No referenceScreenshotsDir defined');
    }

    if (!this._conf.referenceErrorsDir) {
        throw new Error('No referenceErrorsDir defined');
    }

    this._diffTempFolder = '_diff_temp';

    this._diffDescriptors = [];

    this._server = http.createServer(this._onHttpReq.bind(this));
}

DiffServer.prototype.start = async function () {
    console.log('Generating diff image cache...');
    await this._generateDiffCache();
    this._server.listen(this._conf.port);
    console.log(`--- Open http://localhost:${this._conf.port} in your browser ---`);
};

DiffServer.prototype._generateDiffCache = async function () {
    const refErrorPaths = await globAsync(pathlib.join(this._conf.referenceErrorsDir, '**', '*.png'));

    const refScreenshotPaths = refErrorPaths.map(p => p.replace(this._conf.referenceErrorsDir, this._conf.referenceScreenshotsDir));

    await mkdirpAsync(this._diffTempFolder);

    for (const [i, refErrorPath] of refErrorPaths.entries()) {
        const refScreenshotPath = refScreenshotPaths[i];
        // const errorImgBuf=PNG.sync.read(fs.readFileSync(refErrorPath))
        // const refImgBuf=PNG.sync.read(fs.readFileSync(refScreenshotPath))
        // const diffResult = visualImgDiff(refImgBuf, errorImgBuf, { pixelThreshold: 1/100 })
        const diffFilename = refScreenshotPath.replace(this._conf.referenceScreenshotsDir, '').replace(/[\\/]/g, '_');

        const diffDescriptor = new DiffDescriptor({
            id: diffFilename,
            refPath: resolve(refScreenshotPath),
            errPath: resolve(refErrorPath),
            diffPath: resolve(this._diffTempFolder, diffFilename),
        });

        this._diffDescriptors.push(diffDescriptor);

        // fs.writeFileSync(resolve(this._diffTempFolder, diffFilename), PNG.sync.write(diffResult))
    }
};

DiffServer.prototype._onHttpReq = function (req, resp) {
    const parsedUrl = urllib.parse(req.url);
    const query = qs.parse(parsedUrl.query);
    const pathname = parsedUrl.pathname;

    if (pathname === '/') {
        resp.end(
            fs.readFileSync(resolve(__dirname, 'web-app/src/diff.html'), { encoding: 'utf-8' })
            .replace('[[CONFIG]]', JSONF.stringify(this._conf).replace(/'/g, '\\\''))
        );
    }
    else if (pathname === '/script.js') {
        resp.end(fs.readFileSync(resolve(__dirname, '../../dist/diff-app.dist.js')), { encoding: 'utf-8' });
    }
    else if (pathname === '/get-diff-descriptors') {
        resp.setHeader('content-type', 'application/json');
        resp.end(JSON.stringify(this._diffDescriptors));
    }
    else if (pathname === '/get-diff-images-by-id') {
        resp.setHeader('content-type', 'application/json');
        let diffDescriptor = this._diffDescriptors.filter(dd => dd.id === query.id);

        if (!diffDescriptor || diffDescriptor.length === 0) {
            resp.status = 404;
            resp.end(JSON.stringify({ error: 'id not found' }));
        }

        diffDescriptor = diffDescriptor[0];

        try {
            const refImgBase64 = Buffer.from(fs.readFileSync(diffDescriptor.refPath)).toString('base64');
            const errImgBase64 = Buffer.from(fs.readFileSync(diffDescriptor.errPath)).toString('base64');
            const diffImgBase64 = Buffer.from(fs.readFileSync(diffDescriptor.diffPath)).toString('base64');

            resp.end(JSON.stringify({
                refImg: refImgBase64,
                errImg: errImgBase64,
                diffImg: diffImgBase64,
            }));
        }
        catch (err) {
            resp.status = 404;
            resp.end(JSON.stringify({ error: err.message }));
        }
    }
    else {
        resp.status = 404;
        resp.end('404');
    }
};

// id, refPath, errPath, diffPath
function DiffDescriptor(data) {
    this.id = data.id;
    this.refPath = data.refPath;
    this.errPath = data.errPath;
    this.diffPath = data.diffPath;
}
