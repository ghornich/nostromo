const resolve = require('path').resolve;

const filePath = resolve(__dirname, 'test.html');

module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.INFO,

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds: { size: { width: 800, height: 600 }, position: { x: 10, y: 10 } },
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                bounds: { size: { width: 800, height: 600 }, position: { x: 10, y: 10 } },
            }),
        ],
        suites: [
            {
                name: 'getUniqueSelector suite',
                appUrl: `file://${filePath}`,
                testFiles: ['test.js'],
            }
        ]
    };
};
