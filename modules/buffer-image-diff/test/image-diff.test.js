const fs=require('fs')
const PNG=require('pngjs').PNG
const test=require('tape')
const imageDiff=require('../image-diff')

const testImgBuf = PNG.sync.read(fs.readFileSync('resources/wave.png'))
const testImgBuf2 = PNG.sync.read(fs.readFileSync('resources/wave2.png'))

// console.log(testImgBuf)

test('',t=>{
    const result = imageDiff(testImgBuf, testImgBuf2, {pixelThreshold:1/2, imageThreshold:0})

    console.log(result.same, result.difference)

    // console.log(imageDiff.pixelSameEnough(255,255,100,255, 250,250,100,255, 0.02))

    fs.writeFileSync('out.png',PNG.sync.write(result.diffImage))

    t.end()
})


