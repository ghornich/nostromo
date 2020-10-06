const Bitmap = require('../../pnglib').Bitmap;
const bic = require('../');
const resolve = require('path').resolve;

test('buffer image crop', async () => {
    const fullImg = await Bitmap.from(resolve(__dirname, './m82.png'));
    const ref1 = await Bitmap.from(resolve(__dirname, './m82_crop1.png'));
    const ref2 = await Bitmap.from(resolve(__dirname, './m82_crop2.png'));
    const ref3 = await Bitmap.from(resolve(__dirname, './m82_crop3.png'));

    const cropped1 = bic(fullImg, { x: 474, y: 183, width: 133, height: 151 });
    const cropped2 = bic(fullImg, { x: 0, y: 0, width: 245, height: 157 });
    const cropped3 = bic(fullImg, { x: 379, y: 307, width: 261, height: 192 });

    expect(imgcmp(ref1, cropped1)).toBe(true);
    expect(imgcmp(ref2, cropped2)).toBe(true);
    expect(imgcmp(ref3, cropped3)).toBe(true);
});

function imgcmp(a, b) {
    return a.width === b.width && a.height === b.height && a.data.equals(b.data);
}
