// @ts-nocheck
'use strict';

// TODO test using node-dom instead of nostromo

exports = module.exports = function (test) {
    test('get-unique-selector', async t => {
        const results = await t.execFunction(function () {
            return [
                window.uniqueSelector1.get(document.querySelector('[data-test="1"]')),
                window.uniqueSelector1.get(document.querySelector('[data-test="2"]')),
                window.uniqueSelector1.get(document.querySelector('[data-test="3"]')),
                window.uniqueSelector1.get(document.querySelector('[data-test="4"]')),
                window.uniqueSelector1.get(document.querySelector('[data-test="5"]')),
                window.uniqueSelector1.get(document.querySelector('[data-test="6"]')),
            ];
        });

        t.equal(results, [
            'li:nth-child(2)',
            '#li3',
            '.class2',
            '.class1 > .class1',
            'input[name="user"]',
            'span > a',
        ]);
    });

    test('get-unique-selector, ignored classes', async t => {
        const results = await t.execFunction(function () {
            return [
                window.uniqueSelector2.get(document.querySelector('[data-test="1"]')),
                window.uniqueSelector2.get(document.querySelector('[data-test="2"]')),
                window.uniqueSelector2.get(document.querySelector('[data-test="3"]')),
                window.uniqueSelector2.get(document.querySelector('[data-test="4"]')),
                window.uniqueSelector2.get(document.querySelector('[data-test="5"]')),
                window.uniqueSelector2.get(document.querySelector('[data-test="6"]')),
            ];
        });

        t.equal(results, [
            'li:nth-child(2)',
            '#li3',
            'li > span',
            'div > div:nth-child(2)',
            'input[name="user"]',
            'span > a',
        ]);

    });
};
