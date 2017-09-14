const test = require('tape');
const PNG = require('pngjs').PNG;
const bic = require('../');
const resolve = require('path').resolve;
const fs = require('fs');

test(t => {
    let fullImg, ref1, ref2, ref3;

    // no return
    readImgBuffer('./m82.png').then(img => fullImg = img)
    .then(() => readImgBuffer('./m82_crop1.png').then(img => ref1 = img))
    .then(() => readImgBuffer('./m82_crop2.png').then(img => ref2 = img))
    .then(() => readImgBuffer('./m82_crop3.png').then(img => ref3 = img))
    .then(() => {
        const cropped1 = bic(fullImg, { x: 474, y: 183, width: 133, height: 151 });
        const cropped2 = bic(fullImg, { x:   0, y:   0, width: 245, height: 157 });
        const cropped3 = bic(fullImg, { x: 379, y: 307, width: 261, height: 192 });

        t.ok(imgcmp(ref1, cropped1), 'crop 1');
        t.ok(imgcmp(ref2, cropped2), 'crop 2');
        t.ok(imgcmp(ref3, cropped3), 'crop 3');
        t.end();
    })
    // eslint-disable-next-line no-console
    .catch(e => console.error(e));
});

function readImgBuffer(path) {
    return new Promise((res, rej) => {
        fs.createReadStream(resolve(__dirname, path))
        .pipe(new PNG())
        .on('parsed', function () {
            res(this);
        })
        .on('error', rej);
    });
}

function imgcmp(a, b) {
    return a.width === b.width &&
        a.height === b.height &&
        a.data.equals(b.data);
}
