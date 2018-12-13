'use strict';

// TODO unit test

const util = require('util');
const fs = require('fs');
const writeFileAsync = util.promisify(fs.writeFile);
const Jimp = require('jimp');

class Bitmap {
    /**
     * @param {Number} options.width
     * @param {Number} options.height
     * @param {Buffer} options.data
     */
    constructor({ width, height, data }) {
        this.width = width;
        this.height = height;
        this.data = data;
    }

    /**
     * @return {Buffer}
     */
    async toPNGBuffer() {
        return new Jimp({ width: this.width, height: this.height, data: this.data }).getBufferAsync(Jimp.MIME_PNG);
    }

    async toPNGFile(targetPath) {
        const pngBuffer = await this.toPNGBuffer();
        await writeFileAsync(targetPath, pngBuffer);
    }

    async clone() {
        const dataCopy = Buffer.alloc(this.data.length);
        this.data.copy(dataCopy);

        return new Bitmap({
            width: this.width,
            height: this.height,
            data: dataCopy,
        });
    }
}

/**
 * @param {String|Buffer} source
 * @return {Bitmap}
 */
Bitmap.from = async function (source) {
    const jimpImage = await Jimp.read(source);

    return new Bitmap({
        width: jimpImage.bitmap.width,
        height: jimpImage.bitmap.height,
        data: jimpImage.bitmap.data,
    });
};

exports.Bitmap = Bitmap;
