const _ = require('lodash');

exports = module.exports = imageDiff;

const DEFAULT_PIXEL_THRESHOLD = 1 / 100;
const DEFAULT_GROUPING_THRESHOLD = 20;
const DIFFERENT_SIZE_ERROR = 'differentSizeError';

imageDiff.DEFAULT_PIXEL_THRESHOLD = DEFAULT_PIXEL_THRESHOLD;
imageDiff.DEFAULT_GROUPING_THRESHOLD = DEFAULT_GROUPING_THRESHOLD;
imageDiff.DIFFERENT_SIZE_ERROR = DIFFERENT_SIZE_ERROR;

// image: {width, height, data:Buffer of pixel rgba's}
// return [{x1,y1,x2,y2,width,height}]
function imageDiff(a, b, options) {
    const opts = options || {};
    opts.pixelThreshold = opts.pixelThreshold === undefined ? DEFAULT_PIXEL_THRESHOLD : opts.pixelThreshold;
    opts.groupingThreshold = opts.groupingThreshold === undefined ? DEFAULT_GROUPING_THRESHOLD : opts.groupingThreshold;

    // TODO what if images are different size?
    if (a.width !== b.width || a.height !== b.height) {
        const e = new Error('width or height are different');
        e.type = DIFFERENT_SIZE_ERROR;
        throw e;
    }

    if (a.data.equals(b.data)) {
        return [];
    }

    // [{x,y}]
    const diffs = [];

    for (let y = 0, yMax = a.height; y < yMax; y++) {
        for (let x = 0, xMax = a.width; x < xMax; x++) {
            const aPx0 = (y * a.width + x) * 4;
            const bPx0 = (y * b.width + x) * 4;

            const pxa = { r: a.data[aPx0 + 0], g: a.data[aPx0 + 1], b: a.data[aPx0 + 2], a: a.data[aPx0 + 3] };
            const pxb = { r: b.data[bPx0 + 0], g: b.data[bPx0 + 1], b: b.data[bPx0 + 2], a: b.data[bPx0 + 3] };

            if (!diffPx(pxa, pxb, opts.pixelThreshold)) {
                diffs.push({ x: x, y: y, group: null });
            }
        }
    }

    let nextGroup = 0;

    for (let i = 0; i < diffs.length - 1; i++) {
        const diffA = diffs[i];

        if (diffA.group !== null) {
            continue;
        }
        else {
            diffA.group = nextGroup;

            for (let j = i + 1; j < diffs.length; j++) {
                const diffB = diffs[j];
                if (distance(diffA, diffB) < opts.groupingThreshold) {
                    diffB.group = nextGroup;
                }
                // else {
                //     diffB.group=nextGroup+1
                // }
            }
        }

        nextGroup++;
    }

    // console.log('diffs',diffs)

    const groups = _.groupBy(diffs, d => d.group);

    // console.log('groups',groups)


    return _.map(groups, group => {
        const xSort = _.sortBy(group, g => g.x);
        const ySort = _.sortBy(group, g => g.y);

        const leftmost = _.first(xSort);
        const rightmost = _.last(xSort);
        const topmost = _.first(ySort);
        const bottommost = _.last(ySort);

        const x1 = _.clamp(leftmost.x - opts.padding - 1, 0, a.width - 1);
        const y1 = _.clamp(topmost.y - opts.padding - 1, 0, a.height - 1);
        const x2 = _.clamp(rightmost.x + opts.padding + 1, 0, a.width - 1);
        const y2 = _.clamp(bottommost.y + opts.padding + 1, 0, a.height - 1);
        const width = x2 - x1;
        const height = y2 - y1;

        return {
            x1: x1,
            y1: y1,
            x2: x2,
            y2: y2,
            width: width,
            height: height,
        };
    });
}


function distance(diffA, diffB) {
    const x1 = diffA.x, y1 = diffA.y, x2 = diffB.x, y2 = diffB.y;
    return Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
}

// px: {r,g,b,a}
function diffPx(pxa, pxb, threshold) {
    if (pxa.r === pxb.r && pxa.g === pxb.g && pxa.b === pxb.b && pxa.a === pxb.a) {
        return true;
    }

    // TODO incorrect, use |(a-b)/b|
    let rdiff = pxa.r - pxb.r;
    let gdiff = pxa.g - pxb.g;
    let bdiff = pxa.b - pxb.b;
    let adiff = pxa.a - pxb.a;

    if (rdiff < 0) {
        rdiff = -rdiff;
    }
    if (gdiff < 0) {
        gdiff = -gdiff;
    }
    if (bdiff < 0) {
        bdiff = -bdiff;
    }
    if (adiff < 0) {
        adiff = -adiff;
    }

    return rdiff < threshold && gdiff < threshold && bdiff < threshold && adiff < threshold;
}
