const bufferImageDiff = require('../../../modules/buffer-image-diff');

/**
 * @typedef {{ same: boolean, differencePercent: number, diffBitmap: Bitmap }} ImageDifferResult
 */

/**
 * @param {Bitmap} testedImage
 * @param {Bitmap} referenceImage
 * @param {Object} [options]
 * @return {Promise<ImageDifferResult>}
 */
exports = module.exports = async function builtInImageDiffer(testedImage, referenceImage, options = {}) {
    const diffResult = bufferImageDiff(testedImage, referenceImage, { ...options, includeDiffBufferIndexes: true });

    if (diffResult.same) {
        return {
            same: true,
            differencePercent: 0,
            diffBitmap: null,
        };
    }

    const diffBitmap = await testedImage.clone();

    for (const bufIdx of diffResult.diffBufferIndexes) {
        diffBitmap.data[bufIdx] = 255;
        diffBitmap.data[bufIdx + 1] = 0;
        diffBitmap.data[bufIdx + 2] = 0;
    }

    return {
        same: false,
        differencePercent: diffResult.differencePercent,
        diffBitmap,
    };
};
