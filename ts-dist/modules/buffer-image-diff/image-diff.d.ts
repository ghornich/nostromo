export default imageDiff;
export type Bitmap = {
    width: number;
    height: number;
    data: Buffer;
};
export type ImageDiffResult = {
    same: boolean;
    difference: number;
    totalChangedPixels: number;
    diffBufferIndexes?: Array<number>;
};
export type ImageDiffOptions = {
    colorThreshold: number;
    imageThreshold: number;
    equivalenceThreshold?: number;
    /**
     * - Ignore grayscale differences. Zero disables this threshold
     */
    grayscaleThreshold?: number;
    includeDiffBufferIndexes?: number;
    /**
     * - Ignore antialiasing differences by removing diff lines of certain width/height
     */
    noiseLineWidthThreshold?: number;
    noiseLineHeightThreshold?: number;
};
/**
 * @typedef {{ width: number, height: number, data: Buffer }} Bitmap
 */
/**
 * @typedef {Object} ImageDiffResult
 * @property {boolean} same
 * @property {number} difference
 * @property {number} totalChangedPixels
 * @property {Array<Number>} [diffBufferIndexes]
 */
/**
 * @typedef {Object} ImageDiffOptions
 * @property {number} options.colorThreshold
 * @property {number} options.imageThreshold
 * @property {number} [options.equivalenceThreshold = 4]
 * @property {number} [options.grayscaleThreshold = 0] - Ignore grayscale differences. Zero disables this threshold
 * @property {number} [options.includeDiffBufferIndexes = false]
 * @property {number} [options.noiseLineWidthThreshold = 2] - Ignore antialiasing differences by removing diff lines of certain width/height
 * @property {number} [options.noiseLineHeightThreshold = 2]
 */
/**
 * @param {Bitmap} a
 * @param {Bitmap} b
 * @param {ImageDiffOptions} opts
 * @return {ImageDiffResult}
 */
declare function imageDiff(a: Bitmap, b: Bitmap, opts: ImageDiffOptions): ImageDiffResult;
