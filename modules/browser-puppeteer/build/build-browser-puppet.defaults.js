(function () {
    var BrowserPuppet = require('../src/puppet/browser-puppet.js');

    if (window.browserPuppet) {
        console.warn('BrowserPuppet was loaded multiple times');
        return;
    }

    window.browserPuppet = new BrowserPuppet();

    var prevOnload = window.onload;

    window.onload = function () {
        browserPuppet.start();
        prevOnload && prevOnload();
    };
}());
