const Bitmap = require('../pnglib').Bitmap;
const DIFFERENT_SIZE_ERROR = 'differentSizeError';

exports = module.exports = imgVisualDiff;
imgVisualDiff.DIFFERENT_SIZE_ERROR = DIFFERENT_SIZE_ERROR;

const DEF_OPTS = {
    pixelThreshold: 0,
};

/**
 * @param {Bitmap} a
 * @param {Bitmap} b
 * @param {Object} opts
 * @return {Bitmap|null}
 */
function imgVisualDiff(a, b, opts = DEF_OPTS) {
    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        const e = new Error('width or height are different');
        e.type = DIFFERENT_SIZE_ERROR;
        throw e;
    }

    if (a.data.equals(b.data)) {
        return null;
    }

    const diffBitmap = b.clone();

    for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
            const i0 = y * a.width * 4 + x * 4;

            const px1 = { r: a.data[i0], g: a.data[i0 + 1], b: a.data[i0 + 2], a: a.data[i0 + 3] };
            const px2 = { r: b.data[i0], g: b.data[i0 + 1], b: b.data[i0 + 2], a: b.data[i0 + 3] };

            if (!pixelSameEnough(px1, px2, opts.pixelThreshold)) {
                diffBitmap.data[i0] = 255;
                diffBitmap.data[i0 + 1] = 0;
                diffBitmap.data[i0 + 2] = 0;
            }
            // TODO ?
            // else {
            //     const [h, s, l]=rgbToHsl(diffBitmap.data[i0], diffBitmap.data[i0+1], diffBitmap.data[i0+2])
            //     const [r, g, b]=hslToRgb(h, s, clamp(l*1.125, 0, 1))

            //     diffBitmap.data[i0] = r
            //     diffBitmap.data[i0+1] = g
            //     diffBitmap.data[i0+2] = b
            // }
        }
    }

    return diffBitmap;
}

function pixelSameEnough(px1, px2, threshold) {
    if (px1.r === px2.r && px1.g === px2.g && px1.b === px2.b && px1.a === px2.a) {
        return true;
    }

    const avg1 = (px1.r + px1.g + px1.b + px1.a) / 4;
    const avg2 = (px2.r + px2.g + px2.b + px2.a) / 4;
    const pixelDiffPc = diffPc(avg1, avg2);

    return pixelDiffPc <= threshold;
}

function diffPc(a, b) {
    return 2 * Math.abs(a - b) / (a + b);
}
