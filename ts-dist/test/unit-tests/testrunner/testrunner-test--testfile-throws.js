'use strict';
exports = module.exports = function (test) {
    test('throws', t => {
        throw new Error('testfile throws');
    });
};
