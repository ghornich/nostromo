const cp = require('child_process');
const fs = require('fs');
const resolve = require('path').resolve;
const Promise = require('bluebird');
const pngjs = require('pngjs');
const bufferImageSearch = require('../buffer-image-search');
const bufferImageCrop = require('../buffer-image-crop');

const execAsync = Promise.promisify(cp.exec);
const unlinkAsync = Promise.promisify(fs.unlink);

// TODO crop is not a responsibility of this module

/**
 * @typedef {Object} Image
 * @property {Number} width
 * @property {Number} height
 * @property {Buffer} data - raw image data in 4 byte/pixel encoding
 */

/**
 * 
 * @param {Object} [opts]
 * @param {String} [opts.tempPath] - default: "<cwd>/_screenshot_temp.png"
 * @param {String|Image} opts.cropMarker - 
 * @param {} opts.outfile - 
 * @param {} opts. - 
 * @return {[type]}           [description]
 */
module.exports = Promise.method(function (opts) {
    opts = opts || {};

    const tempPath = resolve(opts.tempPath || '_screenshot_temp.png');

    return Promise.try(_ => {

        if (process.platform === 'win32') {
            const screenshotCmdPath = resolve(__dirname, 'platform_modules/screenshot-cmd/screenshot-cmd.exe');

            return execAsync(`${screenshotCmdPath} -o ${tempPath}`);
        }

        // TODO

    })
    .then(_ => new Promise((res, rej) => {
        fs.createReadStream(tempPath)
        .pipe(new pngjs.PNG())
        .on('parsed', function () {
            res({ width: this.width, height: this.height, data: this.data });
        });
    }))
    .then(img => {
        if (!opts.cropMarker) {
            return img;
        }

        return Promise.try(_ => {
            if (typeof opts.cropMarker === 'string') {
                return new Promise((res, rej) => {
                    fs.createReadStream(resolve(opts.cropMarker))
                    .pipe(new pngjs.PNG())
                    .on('parsed', function () {
                        res({ width: this.width, height: this.height, data: this.data });
                    });
                });
            }

            return opts.cropMarker;

        })
        .then(marker => {
            const markerPositions = bufferImageSearch(img, marker);

            if (markerPositions.length !== 2) {
                throw new Error(`Marker count is not 2! Found ${markerPositions.length}`);
            }

            const cropDimensions = {
                x: markerPositions[0].x,
                y: markerPositions[0].y,
                width: markerPositions[1].x - markerPositions[0].x + marker.width,
                height: markerPositions[1].y - markerPositions[0].y + marker.height,
            };

            return bufferImageCrop(img, cropDimensions);

        });
    })
    .then(img => {
        return unlinkAsync(tempPath)
        .then(_ => {
            if (opts.outfile) {
                return new Promise((res, rej) => {
                    const png = new pngjs.PNG(img);
                    png.data = img.data;

                    png
                    .pack()
                    .pipe(fs.createWriteStream(resolve(opts.outfile)))
                    .on('error', rej)
                    .on('end', res);
                });
            }
        })
        .then(_ => ({
            width: img.width,
            height: img.height,
            data: img.data,
        }));
    });
});
