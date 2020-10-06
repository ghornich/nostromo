const pathlib = require('path');
const createServer = require('../utils/create-server').default;

module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.WARN,
        testBailout: true,
        referenceScreenshotsDir: 'reference-screenshots',

        imageDiffOptions: {
            colorThreshold: 5,
            imageThreshold: 10,
            grayscaleThreshold: 5,
        },

        browsers: [
            new config.browsers.Chromium({
                name: 'Chrome',
                width: 750,
                height: 550,
                headless: true,
            }),
        ],

        suites: [
            {
                name: 'getUniqueSelector',
                appUrl: 'http://localhost:31667/test/self-tests/get-unique-selector/test.html',
                testFiles: ['get-unique-selector/test.js'],
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, '../../'), port: 31667 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
            {
                name: 'browser-puppeteer',
                appUrl: 'http://localhost:31667/index.html',
                testFiles: ['browser-puppeteer/test.js'],
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, 'browser-puppeteer'), port: 31667 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
            {
                name: 'test-testapp',
                appUrl: 'http://localhost:31667/index.html',
                testFiles: ['./test-testapp.js'],
                beforeCommand: function (t, command) {
                    if (command.type !== 'assert') {
                        return t.waitWhileVisible('.loading, #toast');
                    }

                    return t.waitWhileVisible('.loading');
                },
                beforeTest: async function () {
                    this.server = await createServer({ dirToServe: pathlib.resolve(__dirname, 'testapp'), port: 31667 });
                },
                afterTest: async function () {
                    return new Promise(resolve => this.server.close(resolve));
                },
            },
        ],
    };
};
