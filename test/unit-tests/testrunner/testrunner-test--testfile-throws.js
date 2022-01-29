'use strict';

exports = module.exports = function (test) {
    test('testrunner-test--testfile-throws', () => {
        throw new Error('testfile throws');
    });
};
