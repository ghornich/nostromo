const pathlib = require('path');

module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.WARN,

        testBailout: true,

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files/Mozilla Firefox/firefox.exe',
                bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
            }),
        ],

        suites: [
            {
                name: 'getUniqueSelector',
                appUrl: 'file:///' + pathlib.resolve(__dirname, 'get-unique-selector/test.html'),
                testFiles: ['get-unique-selector/test.js'],
            },
            {
                name: 'browser-puppeteer',
                appUrl: 'file:///' + pathlib.resolve(__dirname, 'browser-puppeteer/index.html'),
                testFiles: ['browser-puppeteer/test.js'],
            },
        ],
    };
};
