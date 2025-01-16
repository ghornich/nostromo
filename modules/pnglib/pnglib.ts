import { promises as fsp } from 'fs';
import { JimpMime, Jimp } from 'jimp';

export default class Bitmap {
    width: number;
    height: number;
    data: Buffer;

    constructor({ width, height, data }: { width: number, height: number, data: Buffer }) {
        this.width = width;
        this.height = height;
        this.data = data;
    }

    async toPNGBuffer(): Promise<Buffer> {
        // Jimp.fromBuffer(this.data);

        // return new Jimp({ width: this.width, height: this.height, data: this.data }).getBuffer(JimpMime.png);
        const image = new Jimp({ width: this.width, height: this.height, data: this.data });
        return image.getBuffer(JimpMime.png);
    }

    async toPNGFile(targetPath) {
        const pngBuffer = await this.toPNGBuffer();
        await fsp.writeFile(targetPath, pngBuffer);
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

    static async from(source: string | Buffer | Uint8Array): Promise<Bitmap> {
        let jimpImage;

        if (source instanceof Uint8Array) {
            jimpImage = await Jimp.read(Buffer.from(source.buffer, source.byteOffset, source.byteLength));
        }
        else {
            jimpImage = await Jimp.read(source);
        }

        return new Bitmap({
            width: jimpImage.bitmap.width,
            height: jimpImage.bitmap.height,
            data: jimpImage.bitmap.data,
        });
    }
}

