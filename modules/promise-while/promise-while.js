'use strict';

var assert = require('assert');

exports = module.exports = function (promiseLib) {
    assert(typeof promiseLib === 'function', 'promiseLib is not an function');
    assert(typeof promiseLib.resolve === 'function', 'promiseLib.resolve is not a function');

    return function promiseWhile(condition, action) {
        return promiseLib.resolve()
        .then(function () {
            if (!condition()) {
                return;
            }

            return action()
            .then(promiseWhile.bind(null, condition, action));
        });
    };
};
