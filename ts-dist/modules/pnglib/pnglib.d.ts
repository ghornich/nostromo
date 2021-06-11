export var Bitmap: typeof Bitmap;
declare class Bitmap {
    /**
     * @param {Object} options
     * @param {Number} options.width
     * @param {Number} options.height
     * @param {Buffer} options.data
     */
    constructor({ width, height, data }: {
        width: number;
        height: number;
        data: Buffer;
    });
    width: number;
    height: number;
    data: Buffer;
    /**
     * @return {Buffer}
     */
    toPNGBuffer(): Buffer;
    toPNGFile(targetPath: any): Promise<void>;
    clone(): Promise<Bitmap>;
}
declare namespace Bitmap {
    function from(source: string | Buffer): Promise<Bitmap>;
}
export {};
