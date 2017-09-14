(function () {
    var BrowserPuppet = require('../src/puppet/browser-puppet.js');

    if (window.browserPuppet) {
        // eslint-disable-next-line no-console
        console.warn('BrowserPuppet was loaded multiple times');
        return;
    }

    window.browserPuppet = new BrowserPuppet();
    window.browserPuppet.start();
}());
