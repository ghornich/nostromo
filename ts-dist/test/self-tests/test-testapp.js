'use strict';
exports = module.exports = function (test) {
    test('test-testapp', async (t) => {
        await t.click('#show-dialog');
        await t.assert();
        await t.setValue('#input', 'A');
        await t.click('#add-btn');
        await t.screenshot('#add-btn');
        await t.click('.delete');
        await t.assert();
    });
};
