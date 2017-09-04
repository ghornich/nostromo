'use strict';

exports = module.exports = function (test) {
    test('default before/after commands 1', async t => {
        await t.click('.a');
        return t.click('.b');
    });
    test('default before/after commands 2', async t => {
        await t.click('.c');
        return t.click('.d');
    });
};
