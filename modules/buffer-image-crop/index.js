const assert = require('assert');
const Bitmap = require('../pnglib').Bitmap;

module.exports = function (img, conf) {
    // TODO accept bitmap only
    assert(img.width && img.height && img.data, 'invalid img');
    assert(Buffer.isBuffer(img.data), 'img.data is not a buffer');

    assert(isFinite(conf.x + conf.y + conf.width + conf.height), 'invalid conf');

    const result = [];

    for (let y = conf.y; y < conf.height + conf.y; y++) {
        for (let x = conf.x; x < conf.width + conf.x; x++) {
            const pixelStart = img.width * y * 4 + x * 4;

            result.push(
                img.data[pixelStart],
                img.data[pixelStart + 1],
                img.data[pixelStart + 2],
                img.data[pixelStart + 3]
            );
        }
    }

    return new Bitmap({
        width: conf.width,
        height: conf.height,
        data: Buffer.from(result),
    });
};
