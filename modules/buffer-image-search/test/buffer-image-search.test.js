'use strict';

const Bitmap = require('../../pnglib/pnglib').Bitmap;
const resolve = require('path').resolve;
const bufferImageSearch = require('../');

test('buffer-image-search', async () => {
    const testImg1 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/galaxy1.png'));
    const testImg2 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/galaxy2.png'));
    const testImg3 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/galaxy3.png'));

    const marker1 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/marker1.png'));
    const marker2 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/marker2.png'));
    const marker3 = await Bitmap.from(resolve(__dirname, '../../../../modules/buffer-image-search/test/marker3.png'));

    const results1 = bufferImageSearch(testImg1, marker1);
    const results2 = bufferImageSearch(testImg2, marker2);
    const results3 = bufferImageSearch(testImg3, marker3);

    expect(results1).toStrictEqual([
        { x: 0, y: 0 },
        { x: 457, y: 129 },
        { x: 108, y: 1034 },
        { x: 1709, y: 1407 },
    ]);

    expect(results2).toStrictEqual([
        { x: 28, y: 1 },
        { x: 738, y: 190 },
        { x: 1725, y: 652 },
        { x: 0, y: 1419 },
    ]);

    expect(results3).toStrictEqual([
        { x: 743, y: 609 },
        { x: 1012, y: 824 },
    ]);
}, 30000);
