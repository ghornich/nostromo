'use strict';

/* eslint-disable max-statements */

exports = module.exports = function (test, _testrunnerInstance) {
    test('browser-puppeteer commands', async t => {
        await t.click('.click-test-jq');
        t.equal(await t.getValue('.click-test-jq'), 'jqClickOK');

        await t.click('.click-test-dom');
        t.equal(await t.getValue('.click-test-dom'), 'domClickOK');

        await t.focus('.focus-test');

        const activeElClass = await t.execFunction(function () {
            return document.activeElement.className;
        });

        t.equal(activeElClass, 'focus-test');

        t.equal(await t.getValue('.getValue-test'), 'testValue');

        t.equal(await t.isVisible('.isVisible-test-visible'), true);
        t.equal(await t.isVisible('.isVisible-test-hidden'), false);

        await t.mouseover('.mouseover-test');
        await t.delay(250); // getValue happens so fast after mouseover, that the field is still empty
        t.equal(await t.getValue('.mouseover-test'), 'mouseoverOK');

        await t.focus('.pressKey-test');
        await t.pressKey('A');
        t.equal(await t.getValue('.pressKey-test'), 'pressKey65OK');

        await t.scrollTo('#scroll-test--n');

        const scrollToTop = await t.execFunction(function () {
            // eslint-disable-next-line no-undef
            return $('.scroll-test')[0].scrollTop;
        });

        t.equal(scrollToTop, 234);

        // reset scroll
        await t.scroll('.scroll-test', 0);

        await t.scroll('.scroll-test', 190);

        const scrollTop = await t.execFunction(function () {
            // eslint-disable-next-line no-undef
            return $('.scroll-test')[0].scrollTop;
        });

        t.equal(scrollTop, 190);

        await t.setValue('.setValue-test', 'testSetValue');
        t.equal(await t.getValue('.setValue-test'), 'testSetValue');

        // @region waitForVisible test


        await t.execFunction(function () {
            setTimeout(function () {
                // eslint-disable-next-line no-undef
                $('.waitForVisible-test').removeClass('hidden');
            }, 500);
        });

        const waitForVisibleStart = Date.now();
        await t.waitForVisible('.waitForVisible-test');
        const waitForVisibleTestDuration = Date.now() - waitForVisibleStart;

        t.comment('waitForVisible test duration: ' + waitForVisibleTestDuration);
        t.equal(waitForVisibleTestDuration >= 500, true);

        // @endregion

        // @region waitWhileVisible test

        const waitWhileVisibleStart = Date.now();

        await t.execFunction(function () {
            setTimeout(function () {
                // eslint-disable-next-line no-undef
                $('.waitWhileVisible-test').addClass('hidden');
            }, 500);
        });

        await t.waitWhileVisible('.waitWhileVisible-test');
        const waitWhileVisibleTestDuration = Date.now() - waitWhileVisibleStart;

        t.comment('waitWhileVisible test duration: ' + waitWhileVisibleTestDuration);
        t.equal(waitWhileVisibleTestDuration >= 500, true);

        // @endregion

        // @region waitForVisible timeout test

        try {
            const wfvPromise = t.waitForVisible('.no-such-selector', { timeout: 1000 });

            const timeoutPromise = new Promise(r => setTimeout(r, 1500)).then(() => {
                throw new Error('failed to time out after 1s');
            });

            await Promise.race([wfvPromise, timeoutPromise]);
            throw new Error('Unexpected resolve');
        }
        catch (error) {
            if (error.message.indexOf('waitForVisible: timeout') >= 0) {
                t.equal(true, true, 'waitForVisible timeout');
            }
            else {
                t.equal(true, false, 'waitForVisible timeout: ' + error.message);
                throw error;
            }
        }

        // @endregion

        // TODO test waitFor/WhileVisible options and default options
    });
};
