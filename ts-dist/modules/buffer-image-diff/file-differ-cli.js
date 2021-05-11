// @ts-nocheck
const fs = require('fs');
const pathlib = require('path');
const util = require('util');
const glob = util.promisify(require('glob'));
const args = require('minimist')(process.argv.slice(2));
const PNG = require('pngjs').PNG; // TODO deprecated
const bufferImageDiff = require('./image-diff');
const OUTPUT_DIR_NAME = 'diff-results';
const OUTPUT_DIR_ABS_PATH = pathlib.resolve(OUTPUT_DIR_NAME);
if (args._.length === 0 || args.h || args.help) {
    console.log('');
    console.log('Params: <baseRootDir> <changedRootDir> -c <colorThreshold> -i <imageThreshold> -e <equivalenceThreshold> -g <grayscaleThreshold>');
    console.log('');
}
else {
    fileDiffer({
        baseRootDir: args._[0],
        changedRootDir: args._[1],
        colorThreshold: parseFloat(args.c),
        imageThreshold: parseFloat(args.i),
        equivalenceThreshold: parseFloat(args.e),
        grayscaleThreshold: parseFloat(args.g),
    });
}
/**
 * Accepts ImageDiffOptions
 *
 * @param {String} baseRootDir
 * @param {String} changedRootDir
 */
async function fileDiffer(conf) {
    const changedFilePaths = await glob(conf.changedRootDir.replace(/[\\\/]+$/, '') + '/**/*.png');
    try {
        fs.mkdirSync(OUTPUT_DIR_NAME);
    }
    catch (e) {
        // ignore
        // console.error(e)
    }
    for (const changedFilePath of changedFilePaths) {
        console.log(`Scanning ${changedFilePath}`);
        const baseFilePath = changedFilePath.replace(/[^\\\/]+/, conf.baseRootDir);
        const baseImg = PNG.sync.read(fs.readFileSync(baseFilePath));
        const changedImg = PNG.sync.read(fs.readFileSync(changedFilePath));
        const diff = bufferImageDiff(baseImg, changedImg, {
            colorThreshold: conf.colorThreshold,
            imageThreshold: conf.imageThreshold,
            equivalenceThreshold: conf.equivalenceThreshold,
            grayscaleThreshold: conf.grayscaleThreshold,
            includeDiffBufferIndexes: true,
        });
        if (!diff.same) {
            for (const diffIndex of diff.diffBufferIndexes) {
                baseImg.data[diffIndex] = 255;
                baseImg.data[diffIndex + 1] = 0;
                baseImg.data[diffIndex + 2] = 0;
            }
            const outputFilePath = changedFilePath.replace(/[^\\\/]+/, OUTPUT_DIR_NAME);
            const outputDirPath = outputFilePath.replace(/[\\\/][^\\\/]+$/, '');
            try {
                fs.mkdirSync(outputDirPath);
            }
            catch (e) {
                // ignore
                // console.error(e)
            }
            fs.writeFileSync(outputFilePath, PNG.sync.write(baseImg));
        }
    }
}
