const fs = require('fs');
const PNG = require('pngjs').PNG;
const test = require('tape');
const imageVisualDiff = require('../');

// const waveImgBuf = PNG.sync.read(fs.readFileSync('resources/wave.png'))
// const waveImgBuf2 = PNG.sync.read(fs.readFileSync('resources/wave2.png'))
const waveImgBuf = PNG.sync.read(fs.readFileSync('resources/bc.png'));
const waveImgBuf2 = PNG.sync.read(fs.readFileSync('resources/bc2.png'));

test('', t => {
    const imgBuf = imageVisualDiff(waveImgBuf, waveImgBuf2, { pixelThreshold: 0, imageThreshold: 0 });

    fs.writeFileSync('out.png', PNG.sync.write(imgBuf));

    t.end();
});
