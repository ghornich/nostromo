exports = module.exports = imageDiff;

class DifferentSizeError extends Error {
    constructor (message) {
        super(message);
        this.message = message;
        this.name = 'DifferentSizeError';
    }
}

// Image: {width, height, data:Buffer of pixel rgba's}
// a, b: Image
// return {same:Boolean, difference:Number}

/**
 * @typedef {Object} ImageDiffResult
 * @property {Boolean} same
 * @property {Number} difference
 */

/**
 * @typedef {Object} ImageDiffOptions
 * @property {Number} options.colorThreshold
 * @property {Number} options.imageThreshold
 * @property {Number} [options.equivalenceThreshold = 4]
 * @property {Number} [options.grayscaleThreshold = 0] - Ignore grayscale differences. Zero disables this threshold
 */

/**
 * @param {Image} a
 * @param {Image} b
 * @param {ImageDiffOptions} options
 * @return {ImageDiffResult}
 */
function imageDiff(a, b, options) {
    const opts = options || {};
    assert(opts.colorThreshold !== undefined, 'colorThreshold is missing');
    assert(opts.imageThreshold !== undefined, 'imageThreshold is missing');

    if (opts.equivalenceThreshold === undefined) {
        opts.equivalenceThreshold = 4
    }

    if (opts.grayscaleThreshold === undefined) {
        opts.grayscaleThreshold = 0
    }

    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        throw new DifferentSizeError('width or height are different');
    }

    if (a.data.equals(b.data)) {
        return { same: true, difference: 0 };
    }

    let diffPxCount = 0;

    for (let i = 0; i < a.data.length; i += 4) {
        const px1Avg = (a.data[i] + a.data[i + 1] + a.data[i + 2]) / 3
        const px2Avg = (b.data[i] + b.data[i + 1] + b.data[i + 2]) / 3
        const colorDiff=Math.abs(px1Avg-px2Avg)
        const colorDiffPercent=colorDiff/255*100

        if (colorDiff <= opts.equivalenceThreshold) {
            continue
        }

        if (opts.grayscaleThreshold > 0) {
            const rDiff = Math.abs(a.data[i] - b.data[i])
            const gDiff = Math.abs(a.data[i + 1] - b.data[i + 1])
            const bDiff = Math.abs(a.data[i + 2] - b.data[i + 2])
            const diffIsGrayscale = rDiff === gDiff && gDiff === bDiff;

            if (diffIsGrayscale && rDiff <= opts.grayscaleThreshold) {
                continue
            }
        }

        if (colorDiffPercent > opts.colorThreshold) {
            diffPxCount++;
        }
    }

    const totalPxs = a.width * b.width;
    const imgDifference = diffPxCount / totalPxs * 1e6;
    const same = imgDifference <= opts.imageThreshold;

    return { same: same, difference: imgDifference };
}

function assert(v, m) {
    if (!v) {
        throw new Error(m);
    }
}
