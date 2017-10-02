(function () {
    var BrowserPuppet = require('../src/puppet/browser-puppet.js');

    window.addEventListener('load', function () {
        window.browserPuppet = new BrowserPuppet();
        window.browserPuppet.start();
    });
}());
