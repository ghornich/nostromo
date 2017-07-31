exports = module.exports = imageDiff;

imageDiff.pixelSameEnough=pixelSameEnough

const DIFFERENT_SIZE_ERROR = 'differentSizeError';

imageDiff.DIFFERENT_SIZE_ERROR = DIFFERENT_SIZE_ERROR;

// Image: {width, height, data:Buffer of pixel rgba's}
// a, b: Image
// return {same:Boolean, similarity:Number}
function imageDiff(a, b, options) {
    const opts = options || {};
    assert(opts.pixelThreshold!==undefined, 'pixelThreshold is missing')
    assert(opts.imageThreshold!==undefined, 'imageThreshold is missing')

    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        const e = new Error('width or height are different');
        e.type = DIFFERENT_SIZE_ERROR;
        throw e;
    }

    if (a.data.equals(b.data)) {
        return {same:true, difference: 0};
    }

    let diffCount = 0

    const dBrightness=0.3

    for (let i = 0; i < a.data.length; i += 4) {
        if (!pixelSameEnough(a.data[i], a.data[i+1], a.data[i+2], a.data[i+3], b.data[i], b.data[i+1], b.data[i+2], b.data[i+3], opts.pixelThreshold)) {
            diffCount++
        }
    }

    const totalPxs=a.width*b.width
    const imgDifference=diffPc(totalPxs-diffCount, totalPxs)
    const same=imgDifference <= opts.imageThreshold

    return {same:same, difference: imgDifference}
}

function pixelSameEnough(r1, g1, b1, a1, r2, g2, b2, a2, threshold) {
    if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
        return true;
    }

    const avg1=(r1+g1+b1+a1)/4
    const avg2=(r2+g2+b2+a2)/4
    const pixelDiffPc=diffPc(avg1, avg2)

    return pixelDiffPc <= threshold;
}

function diffPc(a,b){
    return 2*Math.abs(a-b)/(a+b)
}

function assert(v,m){if(!v)throw new Error(m)}

function cloneImage(img){
    return {
        width: img.width,
        height: img.height,
        data: Buffer.from(img.data)
    }
}

function clampMin(val,min){
    return val<min?min:val
}
