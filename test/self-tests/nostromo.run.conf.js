const pathlib = require('path');

module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.WARN,
        testBailout: true,
        referenceScreenshotsDir: 'reference-screenshots',

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                width: 750,
                height: 550,
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: [
                    'C:/Program Files/Mozilla Firefox/firefox.exe',
                    'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                ],
                width: 950,
                height: 650,
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
            {
                name: 'test-testrunner',
                appUrl: 'file:///' + pathlib.resolve(__dirname, 'testapp/index.html'),
                testFiles: ['./test-testrunner.js'],
                beforeCommand: function (t, command) {
                    if (command.type !== 'assert') {
                        return t.waitWhileVisible('.loading, #toast');
                    }

                    return t.waitWhileVisible('.loading');
                },
            },
        ],
    };
};
