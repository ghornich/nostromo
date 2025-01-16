"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const jimp_1 = require("jimp");
class Bitmap {
    constructor({ width, height, data }) {
        this.width = width;
        this.height = height;
        this.data = data;
    }
    async toPNGBuffer() {
        // Jimp.fromBuffer(this.data);
        // return new Jimp({ width: this.width, height: this.height, data: this.data }).getBuffer(JimpMime.png);
        const image = new jimp_1.Jimp({ width: this.width, height: this.height, data: this.data });
        return image.getBuffer(jimp_1.JimpMime.png);
    }
    async toPNGFile(targetPath) {
        const pngBuffer = await this.toPNGBuffer();
        await fs_1.promises.writeFile(targetPath, pngBuffer);
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
    static async from(source) {
        let jimpImage;
        if (source instanceof Uint8Array) {
            jimpImage = await jimp_1.Jimp.read(Buffer.from(source.buffer, source.byteOffset, source.byteLength));
        }
        else {
            jimpImage = await jimp_1.Jimp.read(source);
        }
        return new Bitmap({
            width: jimpImage.bitmap.width,
            height: jimpImage.bitmap.height,
            data: jimpImage.bitmap.data,
        });
    }
}
exports.default = Bitmap;
