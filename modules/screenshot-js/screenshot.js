'use strict';

const util = require('util');
const cp = require('child_process');
const execAsync = util.promisify(cp.exec);
const fs = require('fs');
const unlinkAsync = util.promisify(fs.unlink);
const readFileAsync = util.promisify(fs.readFile);
const resolve = require('path').resolve;
const bufferImageSearch = require('../buffer-image-search');
const bufferImageCrop = require('../buffer-image-crop');
const Bitmap = require('../pnglib').Bitmap;

const TEMP_FILE_NAME = '_screenshot_temp.png';

// TODO crop is not a responsibility of this module

/**
 * @deprecated Use Bitmap
 * @typedef {Object} Image
 * @property {Number} width
 * @property {Number} height
 * @property {Buffer} data - raw image data in 4 byte/pixel encoding
 */

/**
 * 
 * @param {Object} [opts]
 * @param {String} [opts.tempPath] - default: "<cwd>/<TEMP_FILE_NAME>"
 * @param {String|Image} opts.cropMarker - 
 * @param {} opts.outfile - 
 * @param {} opts. - 
 * @return {Bitmap}
 */
module.exports = async function screenshot(rawOpts) {
    const opts = rawOpts || {};

    const tempPath = resolve(opts.tempPath || TEMP_FILE_NAME);

    if (process.platform === 'win32') {
        const screenshotCmdPath = resolve(__dirname, 'platform_modules/screenshot-cmd/screenshot-cmd.exe');
        await execAsync(`${screenshotCmdPath} -o ${tempPath}`);
    }
    else {
        // TODO other platforms
        throw new Error('screenshot-js: unsupported platform');
    }

    const screenshot = await Bitmap.from(tempPath);

    if (!opts.cropMarker) {
        return screenshot;
    }

    let marker = opts.cropMarker;

    if (typeof marker === 'string') {
        marker = await Bitmap.from(marker);
    }

    const markerPositions = bufferImageSearch(screenshot, marker);

    if (markerPositions.length !== 2) {
        throw new Error(`Marker count is not 2! Found ${markerPositions.length}`);
    }

    const cropDimensions = {
        x: markerPositions[0].x + marker.width,
        y: markerPositions[0].y + marker.height,
        width: markerPositions[1].x - markerPositions[0].x - marker.width,
        height: markerPositions[1].y - markerPositions[0].y - marker.height,
    };

    const croppedScreenshot = bufferImageCrop(screenshot, cropDimensions);

    await unlinkAsync(tempPath);

    if (opts.outfile) {
        await croppedScreenshot.toPNGFile(opts.outfile);
    }

    return croppedScreenshot;
};
