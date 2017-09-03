'use strict';

const Promise=require('bluebird')
const args = require('minimist')(process.argv.slice(2))
const pathlib=require('path')
const fs=Promise.promisifyAll(require('fs'))
const cliPath = pathlib.resolve('../../src/cli.js')
const cp=require('child_process')
const globAsync=Promise.promisify(require('glob'));

(async function () {
    const testFilePaths=await globAsync('**/*.test.js',{cwd:'../'})
    let testDirs = testFilePaths.map(path=>pathlib.dirname(path))

    testDirs=arrayUnique(testDirs)
    testDirs=testDirs.map(dir=>pathlib.resolve('..', dir))

    console.log(testDirs)

    // var proc = cp.spawn('node', [cliPath, '--run'], {
    //     cwd:testDirs[0]
    // })

    // proc.stdout.on('data', data=>process.stdout.write(data.toString()) )
    // proc.stderr.on('data', data=>process.stderr.write(data.toString()) )

    // proc.on('error',e=>console.log(e))

    // proc.on('exit',(code)=>{
    //     console.log(`proc exit (${code})`)
    // })

}())

function arrayUnique(a){
    return Array.from(new Set(a))
}
