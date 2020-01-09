exports = module.exports = imageDiff;

class DifferentSizeError extends Error {}

/**
 * @typedef {Object} ImageDiffResult
 * @property {Boolean} same
 * @property {Number} differencePercent
 * @property {Number} totalChangedPixels
 * @property {Array<Number>} [diffBufferIndexes]
 */

/**
 * @typedef {Object} ImageDiffOptions
 * @property {Number} options.colorThreshold
 * @property {Number} options.pixelThresholdPercent
 * @property {Number} [options.equivalenceThreshold = 4]
 * @property {Number} [options.grayscaleThreshold = 0] - Ignore grayscale differences. Zero disables this threshold
 * @property {Number} [options.includeDiffBufferIndexes = false]
 */

/**
 * @param {Bitmap} a
 * @param {Bitmap} b
 * @param {ImageDiffOptions} options
 * @return {ImageDiffResult}
 */
function imageDiff(a, b, options) {
    const opts = options || {};
    assert(opts.colorThreshold !== undefined, 'colorThreshold is missing');
    assert(opts.pixelThresholdPercent !== undefined, 'pixelThresholdPercent is missing');

    if (opts.equivalenceThreshold === undefined) {
        opts.equivalenceThreshold = 4;
    }

    if (opts.grayscaleThreshold === undefined) {
        opts.grayscaleThreshold = 0;
    }

    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        throw new DifferentSizeError('width or height are different');
    }

    if (a.data.equals(b.data)) {
        return { same: true, differencePercent: 0, totalChangedPixels: 0 };
    }

    let diffPxCount = 0;
    let totalChangedPixels = 0;
    const diffBufferIndexes = [];

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
            diffPxCount++;

            if (opts.includeDiffBufferIndexes) {
                diffBufferIndexes.push(i);
            }
        }
    }

    const totalPxs = a.width * b.width;
    const differencePercent = diffPxCount / totalPxs * 100;
    const same = differencePercent <= opts.pixelThresholdPercent;
    const result = { same: same, differencePercent, totalChangedPixels: totalChangedPixels };

    if (opts.includeDiffBufferIndexes) {
        result.diffBufferIndexes = diffBufferIndexes;
    }

    return result;
}

function assert(v, m) {
    if (!v) {
        throw new Error(m);
    }
}
