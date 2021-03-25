"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
class DifferentSizeError extends Error {
}
// a, b: Image
// return {same:Boolean, difference:Number}
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
// eslint-disable-next-line complexity
function imageDiff(a, b, opts) {
    var _a, _b, _c;
    assert_1.default(opts.colorThreshold !== undefined, 'colorThreshold is missing');
    assert_1.default(opts.imageThreshold !== undefined, 'imageThreshold is missing');
    (_a = opts.equivalenceThreshold) !== null && _a !== void 0 ? _a : (opts.equivalenceThreshold = 4);
    (_b = opts.grayscaleThreshold) !== null && _b !== void 0 ? _b : (opts.grayscaleThreshold = 0);
    (_c = opts.noiseLineWidthThreshold) !== null && _c !== void 0 ? _c : (opts.noiseLineWidthThreshold = 2);
    if (a.width !== b.width || a.height !== b.height) {
        throw new DifferentSizeError(`width or height are different (A: ${a.width}x${a.height}, B: ${b.width}x${b.height})`);
    }
    if (a.data.equals(b.data)) {
        return { same: true, difference: 0, totalChangedPixels: 0 };
    }
    const width = a.width;
    let totalChangedPixels = 0;
    const diffPixels = new Map(); // <pixelIndex, [x, y]>
    for (let i = 0; i < a.data.length; i += 4) {
        const px1Avg = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3;
        const px2Avg = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 3;
        const colorDiff = Math.abs(px1Avg - px2Avg);
        const colorDiffPercent = colorDiff / 255 * 100;
        if (colorDiff > 0) {
            totalChangedPixels++;
        }
        if (colorDiff <= opts.equivalenceThreshold) {
            continue;
        }
        if (opts.grayscaleThreshold > 0) {
            const rDiff = Math.abs(a.data[i] - b.data[i]);
            const gDiff = Math.abs(a.data[i + 1] - b.data[i + 1]);
            const bDiff = Math.abs(a.data[i + 2] - b.data[i + 2]);
            const diffIsGrayscale = rDiff === gDiff && gDiff === bDiff;
            if (diffIsGrayscale && rDiff <= opts.grayscaleThreshold) {
                continue;
            }
        }
        if (colorDiffPercent > opts.colorThreshold) {
            const pixelIndex = i / 4;
            const x = i / 4 % width;
            const y = Math.floor(i / 4 / width);
            diffPixels.set(pixelIndex, [x, y]);
        }
    }
    const ungroupedDiffs = new Map(diffPixels);
    const boundingBlocks = []; // [pixelIndex, x, y][]
    while (ungroupedDiffs.size > 0) {
        const [currI, [currX, currY]] = ungroupedDiffs.entries().next().value;
        ungroupedDiffs.delete(currI);
        const newBlock = [[currI, currX, currY]];
        const neighborStack = [[currI, currX, currY]];
        while (neighborStack.length > 0) {
            const [i, x, y] = neighborStack.shift();
            // left neighbor
            if (ungroupedDiffs.has(i - 1)) {
                ungroupedDiffs.delete(i - 1);
                newBlock.push([i - 1, x - 1, y]);
                neighborStack.push([i - 1, x - 1, y]);
            }
            // right neighbor
            if (ungroupedDiffs.has(i + 1)) {
                ungroupedDiffs.delete(i + 1);
                newBlock.push([i + 1, x + 1, y]);
                neighborStack.push([i + 1, x + 1, y]);
            }
            // top neighbor
            if (ungroupedDiffs.has(i - width)) {
                ungroupedDiffs.delete(i - width);
                newBlock.push([i - width, x, y - 1]);
                neighborStack.push([i - width, x, y - 1]);
            }
            // bottom neighbor
            if (ungroupedDiffs.has(i + width)) {
                ungroupedDiffs.delete(i + width);
                newBlock.push([i + width, x, y + 1]);
                neighborStack.push([i + width, x, y + 1]);
            }
        }
        boundingBlocks.push(newBlock);
    }
    for (const block of boundingBlocks) {
        const iValues = block.map(val => val[0]);
        const xValues = block.map(val => val[1]);
        const yValues = block.map(val => val[2]);
        const blockWidth = Math.max(...xValues) - Math.min(...xValues) + 1;
        const blockHeight = Math.max(...yValues) - Math.min(...yValues) + 1;
        if (blockWidth <= opts.noiseLineWidthThreshold || blockHeight <= opts.noiseLineHeightThreshold) {
            iValues.forEach(i => diffPixels.delete(i));
        }
    }
    const totalPxs = a.width * b.width;
    const imgDifference = diffPixels.size / totalPxs * 1e6;
    const same = imgDifference <= opts.imageThreshold;
    const result = { same: same, difference: imgDifference, totalChangedPixels: totalChangedPixels };
    if (opts.includeDiffBufferIndexes) {
        result.diffBufferIndexes = [...diffPixels.keys()].map(i => i * 4);
    }
    return result;
}
exports.default = imageDiff;
