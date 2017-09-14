'use strict';

const test = require('tape');
const promiseWhile = require('../promise-while')(Promise);

test('promise while', t => {
    let i = 0;
    const abc = 'abcdefgh'.split('');
    let result = '';
    const startTime = Date.now();

    promiseWhile(
        function () {
            return i <= 7;
        },
        function () {
            result += abc[i];
            i++;

            return new Promise(resolve => {
                setTimeout(resolve, 100);
            });
        }
    )
    .then(() => {
        const elapsed = Date.now() - startTime;

        t.equal(result, 'abcdefgh');
        t.ok(elapsed >= 700, 'delay was correct');
        t.end();
    });
});
