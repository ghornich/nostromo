const Promise = require('bluebird');
module.exports = function (config) {
    return {
        logLevel: config.LOG_LEVELS.INFO,
        beforeCommand: function (t, command) {
        },

        afterCommand: function (t, command) {
            // return Promise.delay(2000)
        },


        beforeTest: function () {
            return Promise.delay(5000);
            // console.log('before test')
        },

        afterTest: function () {
            // console.log('after test')
        },

        appUrl: 'file:///D:/GITHUB/nostromo/test/test.html',

        browsers: [
            new config.browsers.Chrome({
                name: 'Chrome',
                path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
                bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
            }),
            new config.browsers.Firefox({
                name: 'Firefox',
                path: 'C:/Program Files (x86)/Mozilla Firefox/firefox.exe',
                bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
            }),
        ],
        testFiles: ['testfile.js'],
    };
};
