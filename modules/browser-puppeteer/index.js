// prevents browserify from requiring this module
var browserPuppeteerPath = './src/puppeteer/browser-puppeteer';

try {
	exports.BrowserPuppeteer = require(browserPuppeteerPath);
}
catch (error) {
	console.log('Ignored error: can\'t require BrowserPuppeteer');
}

exports.SCREENSHOT_MARKER = require('./src/screenshot-marker');
exports.MESSAGES = require('./src/messages');
exports.COMMANDS =require('./src/commands')
