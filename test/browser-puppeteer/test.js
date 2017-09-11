'use strict';

exports = module.exports = function (test) {
    test('browser-puppeteer commands', async t => {
        await t.click('.click-test-jq')
        t.equal(await t.getValue('.click-test-jq'), 'OK')

        await t.click('.click-test-dom')
        t.equal(await t.getValue('.click-test-dom'), 'OK')
    });
};
