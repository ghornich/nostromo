'use strict';

const promiseWhile = require('../promise-while')(Promise);

test('promise while', async () => {
    let i = 0;
    const abc = 'abcdefgh'.split('');
    let result = '';
    const startTime = Date.now();

    await promiseWhile(
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

        expect(result).toBe('abcdefgh');
        expect(elapsed).toBeGreaterThanOrEqual(700);
    });
});
