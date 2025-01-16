'use strict';

/* eslint-disable max-statements */

// TODO don't use jquery

exports = module.exports = function (test) {
    test('basic commands', async t => {
        await t.click('.click-test');
        t.equal(await t.getValue('.click-test'), 'clickOK');

        await t.focus('.focus-test');

        const activeElClass = await t.execFunction(function () {
            // @ts-expect-error
            return document.activeElement.className;
        });

        t.equal(activeElClass, 'focus-test');

        t.equal(await t.getValue('.getValue-test'), 'testValue');

        t.equal(await t.isVisible('.isVisible-test-visible'), true);
        t.equal(await t.isVisible('.isVisible-test-hidden'), false);

        await t.mouseover('.mouseover-test');
        t.equal(await t.getValue('.mouseover-test'), 'mouseoverOK');

        await t.focus('.pressKey-test');
        await t.pressKey('A');
        t.equal(await t.getValue('.pressKey-test'), 'pressKey65OK');

        await t.scrollTo('#scroll-test--n');

        const scrollToTop = await t.execFunction(function () {
            // eslint-disable-next-line no-undef
            // @ts-expect-error
            return document.querySelector('.scroll-test').scrollTop;
        });

        // t.equal(scrollToTop, 234);
        t.ok(Math.abs(scrollToTop - 234) < 5, '.scroll-test scrollTop threshold 1');

        // reset scroll
        await t.scroll('.scroll-test', 0);

        await t.scroll('.scroll-test', 190);

        const scrollTop = await t.execFunction(function () {
            // eslint-disable-next-line no-undef
            // @ts-expect-error
            return document.querySelector('.scroll-test').scrollTop;
        });

        // t.equal(scrollTop, 190);
        t.ok(Math.abs(scrollTop - 190) < 3, '.scroll-test scrollTop threshold 2');

        await t.setValue('.setValue-test', 'testSetValue');
        t.equal(await t.getValue('.setValue-test'), 'testSetValue');

        await t.setValue('.setValue-test', 'testSetValue2');
        t.equal(await t.getValue('.setValue-test'), 'testSetValue2');

        // @region waitForVisible test

        const waitForVisibleStart = Date.now();

        await t.execFunction(function () {
            setTimeout(function () {
                // eslint-disable-next-line no-undef
                // @ts-expect-error
                document.querySelector('.waitForVisible-test').classList.remove('hidden');
            }, 2000);
        });

        await t.waitForVisible('.waitForVisible-test');
        const waitForVisibleTestDuration = Date.now() - waitForVisibleStart;

        t.comment('waitForVisible test duration: ' + waitForVisibleTestDuration);
        t.equal(waitForVisibleTestDuration > 2000, true);

        // @endregion

        // @region waitWhileVisible test

        const waitWhileVisibleStart = Date.now();

        await t.execFunction(function () {
            setTimeout(function () {
                // eslint-disable-next-line no-undef
                // @ts-expect-error
                document.querySelector('.waitWhileVisible-test').classList.add('hidden');
            }, 2000);
        });

        await t.waitWhileVisible('.waitWhileVisible-test');
        const waitWhileVisibleTestDuration = Date.now() - waitWhileVisibleStart;

        t.comment('waitWhileVisible test duration: ' + waitWhileVisibleTestDuration);
        t.equal(waitWhileVisibleTestDuration > 2000, true);

        // @endregion
    });
};
