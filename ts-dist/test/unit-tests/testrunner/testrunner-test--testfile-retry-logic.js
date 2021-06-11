'use strict';
exports = module.exports = function (test) {
    let retryLogicTestRuns = 0;
    test('testrunner-test--testfile-retry-logic', async (t) => {
        retryLogicTestRuns++;
        if (retryLogicTestRuns % 3 === 0) {
            await t.click('#show-dialog');
        }
        else {
            await t.click('.does-not-exist');
        }
    });
};
