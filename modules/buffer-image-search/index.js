const assert = require('assert');

module.exports = function (haystack, needle) {
    // TODO more asserts
    assert(haystack.width && haystack.height && haystack.data, 'incorrect format of "haystack"');
    assert(needle.width && needle.height && needle.data, 'incorrect format of "needle"');
    assert(Buffer.isBuffer(haystack.data), '"haystack.data" is not a Buffer');
    assert(Buffer.isBuffer(needle.data), '"needle.data" is not a Buffer');

    const results = [];

    for (let haystackY = 0, hYmax = haystack.height - needle.height; haystackY <= hYmax; haystackY++) {
        cnt: for (let haystackX = 0, hXmax = haystack.width - needle.width; haystackX <= hXmax; haystackX++) {

            for (let needleY = 0; needleY < needle.height; needleY++) {
                for (let needleX = 0; needleX < needle.width; needleX++) {
                    const haystackPixelStart = (haystackY + needleY) * haystack.width * 4 + (haystackX + needleX) * 4;
                    const needlePixelStart = needleY * needle.width * 4 + needleX * 4;

                    const hpx0 = haystack.data[haystackPixelStart];
                    const hpx1 = haystack.data[haystackPixelStart + 1];
                    const hpx2 = haystack.data[haystackPixelStart + 2];
                    const hpx3 = haystack.data[haystackPixelStart + 3];

                    const npx0 = needle.data[needlePixelStart];
                    const npx1 = needle.data[needlePixelStart + 1];
                    const npx2 = needle.data[needlePixelStart + 2];
                    const npx3 = needle.data[needlePixelStart + 3];

                    if (hpx0 !== npx0 || hpx1 !== npx1 || hpx2 !== npx2 || hpx3 !== npx3) {
                        continue cnt;
                    }
                }
            }

            results.push({ x: haystackX, y: haystackY });
        }
    }

    return results;
};
