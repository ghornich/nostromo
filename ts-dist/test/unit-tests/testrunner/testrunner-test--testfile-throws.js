'use strict';
exports = module.exports = function (test) {
    test('testrunner-test--testfile-throws', t => {
        throw new Error('testfile throws');
    });
};
