/* eslint-disable no-console */

const resolve = require('path').resolve;
const Promise = require('bluebird');
const execAsync = Promise.promisify(require('child_process').exec);

const buildDefaultsJs = resolve(__dirname, '../build-browser-puppet.defaults.js');
const buildDistJs = resolve(__dirname, '../build-browser-puppet.dist.js');
const distDefaultsJs = resolve(__dirname, '../../dist/browser-puppet.defaults.js');
const distDistJs = resolve(__dirname, '../../dist/browser-puppet.dist.js');
const browserifyCli = resolve(__dirname, '../../../../node_modules/.bin/browserify');

execAsync(`${browserifyCli} ${buildDefaultsJs} -o ${distDefaultsJs}`)
.then(() => execAsync(`${browserifyCli} ${buildDistJs} -o ${distDistJs}`))
.then(() => console.log('Success'))
.catch(err => console.log(err));
