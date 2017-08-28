
const DIFFERENT_SIZE_ERROR = 'differentSizeError';

exports = module.exports = imgVisualDiff;
imgVisualDiff.DIFFERENT_SIZE_ERROR = DIFFERENT_SIZE_ERROR;

const DEF_OPTS = {
    pixelThreshold: 0,
};

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

    const diffImgBuf = cloneImage(b);

    for (let y = 0; y < a.height; y++) {
        for (let x = 0; x < a.width; x++) {
            const i0 = y * a.width * 4 + x * 4;

            const r1 = a.data[i0];
            const g1 = a.data[i0 + 1];
            const b1 = a.data[i0 + 2];
            const a1 = a.data[i0 + 3];

            const r2 = b.data[i0];
            const g2 = b.data[i0 + 1];
            const b2 = b.data[i0 + 2];
            const a2 = b.data[i0 + 3];

            if (!pixelSameEnough(r1, g1, b1, a1, r2, g2, b2, a2, opts.pixelThreshold)) {
                diffImgBuf.data[i0] = 255;
                diffImgBuf.data[i0 + 1] = 0;
                diffImgBuf.data[i0 + 2] = 0;
            }
            // else {
            //     const [h, s, l]=rgbToHsl(diffImgBuf.data[i0], diffImgBuf.data[i0+1], diffImgBuf.data[i0+2])
            //     const [r, g, b]=hslToRgb(h, s, clamp(l*1.125, 0, 1))

            //     diffImgBuf.data[i0] = r
            //     diffImgBuf.data[i0+1] = g
            //     diffImgBuf.data[i0+2] = b
            // }
        }
    }

    return diffImgBuf;
}

function pixelSameEnough(r1, g1, b1, a1, r2, g2, b2, a2, threshold) {
    if (r1 === r2 && g1 === g2 && b1 === b2 && a1 === a2) {
        return true;
    }

    const avg1 = (r1 + g1 + b1 + a1) / 4;
    const avg2 = (r2 + g2 + b2 + a2) / 4;
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

function cloneImage(img) {
    return {
        width: img.width,
        height: img.height,
        data: Buffer.from(img.data),
    };
}

function clamp(val, min, max) {
    if (val < min) {
        return min;
    }
    if (val > max) {
        return max;
    }
    return val;
}

// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s == 0) {
        r = g = b = l; // achromatic
    }
    else {
        const hue2rgb = function hue2rgb(p, q, t) {
            if (t < 0) {
                t += 1;
            }
            if (t > 1) {
                t -= 1;
            }
            if (t < 1 / 6) {
                return p + (q - p) * 6 * t;
            }
            if (t < 1 / 2) {
                return q;
            }
            if (t < 2 / 3) {
                return p + (q - p) * (2 / 3 - t) * 6;
            }
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsl(r, g, b) {
    r /= 255, g /= 255, b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}




