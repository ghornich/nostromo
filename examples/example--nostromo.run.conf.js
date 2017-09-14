'use strict';

exports = module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.WARN,
        testPort: 47225,
        testBailout: true,
        bailout: false,

        defaultAppUrl: 'http://url-to-my-app.com',

        referenceScreenshotDir: 'referenceScreenshots',

        defaultBeforeSuite: async function () {
        },

        defaultAfterSuite: async function () {
        },

        defaultBeforeTest: async function (t) {
        },

        defaultAfterTest: async function (t) {
        },

        defaultBeforeCommand: async function (t) {
        },

        defaultAfterCommand: async function (t) {
        },

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe'
                // no bounds means fullscreen
            })
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

                beforeTest: async function (t) {
                },

                afterTest: async function (t) {
                },

                beforeCommand: async function (t) {
                },

                afterCommand: async function (t) {
                }
            }
            // ...
        ]
    };
};
