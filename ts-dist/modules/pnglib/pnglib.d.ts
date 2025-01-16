/// <reference types="node" />
/// <reference types="node" />
export default class Bitmap {
    width: number;
    height: number;
    data: Buffer;
    constructor({ width, height, data }: {
        width: number;
        height: number;
        data: Buffer;
    });
    toPNGBuffer(): Promise<Buffer>;
    toPNGFile(targetPath: any): Promise<void>;
    clone(): Promise<Bitmap>;
    static from(source: string | Buffer | Uint8Array): Promise<Bitmap>;
}
