'use strict';

exports = module.exports = function (test) {
    test('testrunner-test--testfile-retry-logic', async t => {
        global.retryLogicTestRuns++;

        if (global.retryLogicTestRuns === 3) {
            await t.click('#show-dialog');
        }
        else {
            await t.click('.does-not-exist');
        }
    });
};
