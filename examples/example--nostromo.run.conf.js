'use strict';

exports = module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.WARN,
        testPort: 47225,
        testBailout: true,
        bailout: false,

        referenceScreenshotsDir: 'reference-screenshots',
        referenceErrorsDir: 'reference-errors',
        referenceDiffsDir: 'reference-diffs',

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                width: 1024,
                height: 750,
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                // no width/height: stretch to maximum size
            }),
            // ...
        ],

        suites: [
            {
                name: 'My suite',
                appUrl: 'http://url-to-my-app.com/index.html',
                testFiles: ['a-file.js', 'a-glob/**/*.js'],

                beforeSuite: async function () {
                },

                afterSuite: async function () {
                },

                beforeTest: async function () {
                },

                afterTest: async function () {
                },

                beforeFirstCommand: async function () {
                },

                beforeCommand: async function () {
                },

                afterCommand: async function () {
                },

                afterLastCommand: async function () {
                },

                beforeAssert: async function () {
                },

                afterAssert: async function () {
                },
            },
            // ...
        ],
    };
};
