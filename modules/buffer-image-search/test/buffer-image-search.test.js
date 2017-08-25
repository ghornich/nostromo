var test=require('tape')
var pngjs=require('pngjs')
var fs=require('fs')
var resolve=require('path').resolve

var bufferImageSearch=require('../')

var testImg1=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'galaxy1.png')))
var testImg2=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'galaxy2.png')))
var testImg3=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'galaxy3.png')))

var marker1=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'marker1.png')))
var marker2=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'marker2.png')))
var marker3=pngjs.PNG.sync.read(fs.readFileSync(resolve(__dirname, 'marker3.png')))

test(t=>{
    var results1 = bufferImageSearch(testImg1, marker1)
    var results2 = bufferImageSearch(testImg2, marker2)
    var results3 = bufferImageSearch(testImg3, marker3)

    t.deepEqual(results1, [
        { x: 0, y: 0 },
        { x: 457, y: 129 },
        { x: 108, y: 1034 },
        { x: 1709, y: 1407 }
    ])

    t.deepEqual(results2, [
        { x: 28, y: 1 },
        { x: 738, y: 190 },
        { x: 1725, y: 652 },
        { x: 0, y: 1419 }
    ])

    t.deepEqual(results3, [
        { x: 743, y: 609 },
        { x: 1012, y: 824 }
    ])

    t.end()
})