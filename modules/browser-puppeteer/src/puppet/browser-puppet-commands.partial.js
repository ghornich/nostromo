'use strict';

var Promise = require('bluebird');
var promiseWhile = require('../../../../modules/promise-while')(Promise);

exports = module.exports = BrowserPuppetCommands;

function BrowserPuppetCommands() {
	throw new Error('Can\'t create instance of static class "BrowserPuppetCommands"');
}

BrowserPuppetCommands.prototype.scroll = function (selector, scrollTop) {
    var $el = this.$(selector);

    if ($el.length === 0) {
        throw new Error('Unable to scroll "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to scroll "' + selector + '": not unique');
    }

    $el[0].scrollTop = scrollTop;
};

BrowserPuppetCommands.prototype.mouseover = function (selector) {
    var $el = this.$(selector);

    if ($el.length === 0) {
        throw new Error('Unable to mouseover "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to mouseover "' + selector + '": not unique');
    }

    $el.trigger('mouseover');
};

// TODO timeout, pollInterval
// TODO document caveats
BrowserPuppetCommands.prototype.waitForVisible = Promise.method(function (selector) {
    var pollInterval = 500;
    var self = this;

    if (self.isSelectorVisible(selector)) {
        return;
    }

    return promiseWhile(
        function () {
            return !self.isSelectorVisible(selector);
        },
        function () {
            return Promise.delay(pollInterval);
        }
    );
});

// TODO timeout, pollInterval, initialDelay
// TODO document caveats
BrowserPuppetCommands.prototype.waitWhileVisible = Promise.method(function (selector) {
    var pollInterval = 500;
    var initialDelay = 500;
    var self = this;

    console.log('waitWhileVisible: starting, initialDelay: ' + initialDelay);

    return Promise.delay(initialDelay)
    .then(function () {
        if (!self.isSelectorVisible(selector)) {
            console.log('WWV: selector wasnt visible: ' + selector);
            return;
        }

        return promiseWhile(
            function () {
                var result = self.isSelectorVisible(selector);
                console.log('WWV: visibility: ' + selector + ', ' + result);
                return result;
            },
            function () {
                console.log('WWV: delaying');
                return Promise.delay(pollInterval);
            }
        );

    });
});

BrowserPuppetCommands.prototype.click = function (selector) {
    var $el = this.$(selector);

    if ($el.length === 0) {
        throw new Error('Unable to click selector "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to click selector "' + selector + '": not unique');
    }
    else {
        // var el = $el[0];

        // TODO detect inaccessible nodes !!!

        // if (TestToolsBase.isNodeOccluded(el)) {
        //     var occludingNode = TestToolsBase.getOccludingNode(el)
        //     console.log('OCCLUSION DETECTED - selector: ' + selector + ', occluded by: ' + occludingNode.outerHTML.substr(0,50) + ' (...)')
        //     throw new Error('Unable to click selector "'+selector+'": is occluded by other node(s)')
        // }

        // console.log('No occlusion detected for '+selector)

        // $el.trigger('click');
        $el[0].click();
    }
};

// TODO handle meta keys, arrow keys
// TODO which event to use? keyup, keydown, keypress?
BrowserPuppetCommands.prototype.pressKey = function (selector, keyCode) {
    var $el = this.$(selector);

    if ($el.length === 0) {
        throw new Error('Unable to press key ' + keyCode + ' for "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to press key ' + keyCode + ' for "' + selector + '": not unique');
    }
    else {
        console.log(typeof keyCode, keyCode);
        // eslint-disable-next-line new-cap
        $el.trigger(this.$.Event('keydown', { which: Number(keyCode), keyCode: Number(keyCode) }));
    }
};

BrowserPuppetCommands.prototype.setValue = function (selector, value) {
    var $el = this.$(selector);
    var el = $el[0];
    var tagName = el && el.tagName || '';

    if ($el.length === 0) {
        throw new Error('Unable to set value of "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to set value of "' + selector + '": not unique');
    }
    else if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        throw new Error('Unable to set value of "' + selector + '": unsupported tag "' + tagName + '"');
    }
    else {
        $el.val(value);
        $el.trigger('input');
    }
};

BrowserPuppetCommands.prototype.focus = function (selector) {
    var $el = this.$(selector);

    if ($el.length === 0) {
        throw new Error('Unable to focus selector "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to focus selector "' + selector + '": not unique');
    }
    else {
        $el[0].focus();
    }
};

BrowserPuppetCommands.prototype.getValue = function (selector) {
    var $el = $(selector);
    var el = $el[0];

    if ($el.length === 0) {
        throw new Error('Unable to get value for "' + selector + '": not found');
    }
    else if ($el.length > 1) {
        throw new Error('Unable to get value for "' + selector + '": not unique');
    }

    // TODO util fn to get node value

    // TODO handle all val() nodes
    if (el.tagName === 'INPUT' && el.type === 'checkbox') {
        return el.checked;
    }
    else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        /* nl2backslashnl(*/
        return $el.val().replace(/\n/g, '\\n');
    }
    /* nl2backslashnl(*/
    return $el.text().replace(/\n/g, '\\n');

};

BrowserPuppetCommands.prototype.isVisible = function (selector) {
    return $(selector).length > 0;
};
