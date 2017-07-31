const fs=require('fs')
const PNG=require('pngjs').PNG
const test=require('tape')
const imageDiff=require('../image-diff')

const testImgBuf = PNG.sync.read(fs.readFileSync('resources/test.png'))
const testImgBuf2 = PNG.sync.read(fs.readFileSync('resources/test2.png'))

const waveImgBuf = PNG.sync.read(fs.readFileSync('resources/wave.png'))
const waveImgBuf2 = PNG.sync.read(fs.readFileSync('resources/wave2.png'))

test('',t=>{
    console.log(
        imageDiff(waveImgBuf, waveImgBuf2, {pixelThreshold:0, imageThreshold:0})
    )

    console.log(
        imageDiff(testImgBuf, testImgBuf2, {pixelThreshold:0, imageThreshold:0})
    )

    console.log(
        imageDiff(waveImgBuf, waveImgBuf2, {pixelThreshold:1/100, imageThreshold:0})
    )

    console.log(
        imageDiff(testImgBuf, testImgBuf2, {pixelThreshold:1/100, imageThreshold:0})
    )

    console.log(
        imageDiff(waveImgBuf, waveImgBuf2, {pixelThreshold:1, imageThreshold:0})
    )

    console.log(
        imageDiff(testImgBuf, testImgBuf2, {pixelThreshold:0.5, imageThreshold:0})
    )

    t.end()
})
