(function () {
    var BrowserPuppet = require('../src/puppet/browser-puppet.js');
    window.browserPuppet = new BrowserPuppet();

    var prevOnload = window.onload;

    window.onload = function () {
        browserPuppet.start();
        prevOnload && prevOnload();
    };
}());
