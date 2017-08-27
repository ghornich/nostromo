'use strict';

exports = module.exports = function (test) {
    test('get-unique-selector', async t => {
        var results=await t.execFunction(function () {
            return [
                uniqueSelector1.get(document.querySelector('[data-test="1"]')),
                uniqueSelector1.get(document.querySelector('[data-test="2"]')),
                uniqueSelector1.get(document.querySelector('[data-test="3"]')),
                uniqueSelector1.get(document.querySelector('[data-test="4"]')),
                uniqueSelector1.get(document.querySelector('[data-test="5"]')),
                uniqueSelector1.get(document.querySelector('[data-test="6"]')),
            ]
        })

        t.equal(results, [
            'li:nth-child(2)',
            '#li3',
            '.class2',
            '.class1 .class1',
            'input[name="user"]',
            'span a',
        ])
    });

    test('get-unique-selector, ignored classes', async t => {
        var results=await t.execFunction(function () {
            return [
                uniqueSelector2.get(document.querySelector('[data-test="1"]')),
                uniqueSelector2.get(document.querySelector('[data-test="2"]')),
                uniqueSelector2.get(document.querySelector('[data-test="3"]')),
                uniqueSelector2.get(document.querySelector('[data-test="4"]')),
                uniqueSelector2.get(document.querySelector('[data-test="5"]')),
                uniqueSelector1.get(document.querySelector('[data-test="6"]')),
            ]
        })

        t.equal(results, [
            'li:nth-child(2)',
            '#li3',
            'li span',
            'div div:nth-child(2)',
            'input[name="user"]',
            'span a',
        ])

    });
};
