'use strict';

exports = module.exports = function (test) {
    test('', t => {
        return t.focus('.in1')
        .then(() => t.click('.in1'))
        .then(() => t.setValue('.in1', 'a'))
        .then(() => t.focus('.in2'))
        .then(() => t.click('.in2'))
        .then(() => t.setValue('.in2', 'b'))
        .then(() => t.focus('.a:nth-child(1) button'))
        .then(() => t.click('.a:nth-child(1) button'))
        .then(() => t.assertScreenshot())
    });
};
