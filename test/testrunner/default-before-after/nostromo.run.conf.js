'use strict';

const pathlib = require('path');
const browserBounds = { size: { width: 800, height: 600 }, position: { x: 10, y: 10 } };

exports = module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.OFF,
        defaultBeforeCommand: function (t) {
            t.comment('  -- defaultBeforeCommand')
        },

        defaultAfterCommand: function (t) {
            t.comment('  -- defaultAfterCommand')
        },

        defaultBeforeTest: function (t) {
            t.comment('  -- defaultBeforeTest')
        },

        defaultAfterTest: function (t) {
            t.comment('  -- defaultAfterTest')
        },

        appUrl: `file:///${pathlib.resolve(__dirname, 'test.html')}`,

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds: browserBounds,
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                bounds: browserBounds,
            }),
        ],
        testFiles: ['default-before-after1.js', 'default-before-after2.js'],
    };
};
