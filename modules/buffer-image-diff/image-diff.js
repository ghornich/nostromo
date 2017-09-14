exports = module.exports = imageDiff;

imageDiff.pixelSameEnough = pixelSameEnough;

const DIFFERENT_SIZE_ERROR = 'differentSizeError';

imageDiff.DIFFERENT_SIZE_ERROR = DIFFERENT_SIZE_ERROR;

// Image: {width, height, data:Buffer of pixel rgba's}
// a, b: Image
// return {same:Boolean, similarity:Number}
function imageDiff(a, b, options) {
    const opts = options || {};
    assert(opts.pixelThreshold !== undefined, 'pixelThreshold is missing');
    assert(opts.imageThreshold !== undefined, 'imageThreshold is missing');

    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        const e = new Error('width or height are different');
        e.type = DIFFERENT_SIZE_ERROR;
        throw e;
    }

    if (a.data.equals(b.data)) {
        return { same: true, difference: 0 };
    }

    let diffCount = 0;

    for (let i = 0; i < a.data.length; i += 4) {
        const px1 = { r: a.data[i], g: a.data[i + 1], b: a.data[i + 2], a: a.data[i + 3] };
        const px2 = { r: b.data[i], g: b.data[i + 1], b: b.data[i + 2], a: b.data[i + 3] };

        if (!pixelSameEnough(px1, px2, opts.pixelThreshold)) {
            diffCount++;
        }
    }

    const totalPxs = a.width * b.width;
    const imgDifference = diffPc(totalPxs - diffCount, totalPxs);
    const same = imgDifference <= opts.imageThreshold;

    return { same: same, difference: imgDifference };
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

function assert(v, m) {
    if (!v) {
        throw new Error(m);
    }
}
