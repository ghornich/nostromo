'use strict';

exports = module.exports = function (test) {
    test('default before/after commands 3', async t => {
        await t.click('.e');
        return t.click('.f');
    });
    test('default before/after commands 4', async t => {
        await t.click('.g');
        return t.click('.h');
    });
};
