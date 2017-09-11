'use strict';

exports = module.exports = function (test) {
    test('browser-puppeteer commands', async t => {
        await t.click('.click-test-jq')
        t.equal(await t.getValue('.click-test-jq'), 'OK')

        await t.click('.click-test-dom')
        t.equal(await t.getValue('.click-test-dom'), 'OK')

        await t.composite([
            { type: 'click', selector: '.composite-test-click' },
            { type: 'setValue', selector: '.composite-test-setValue', value: 'valOK' }
        ])

        t.equal(await t.getValue('.composite-test-click'), 'OK')
        t.equal(await t.getValue('.composite-test-setValue'), 'valOK')

        await t.focus('.focus-test')

        const activeElClass = await t.execFunction(function () {
            return document.activeElement.className;
        })

        t.equal(activeElClass, 'focus-test')

        t.equal(await t.getValue('.getValue-test'), 'testValue')

        t.equal(await t.isVisible('.isVisible-test-visible'), true)
        t.equal(await t.isVisible('.isVisible-test-hidden'), false)

        await t.mouseover('.mouseover-test')
        t.equal(await t.getValue('.mouseover-test'), 'mouseoverOK')

        await t.pressKey('.pressKey-test', 65)
        t.equal(await t.getValue('.pressKey-test'), 'OK65')

        await t.scroll('.scroll-test', 190)

        const scrollTop = await t.execFunction(function () {
            return $('.scroll-test')[0].scrollTop;
        })

        t.equal(scrollTop, 190)

        await t.setValue('.setValue-test', 'testSetValue')
        t.equal(await t.getValue('.setValue-test'), 'testSetValue')

        // @region waitForVisible test

        const waitForVisibleStart = Date.now();

        await t.execFunction(function () {
            setTimeout(function () {
                $('.waitForVisible-test').removeClass('hidden');
            }, 2000)
        })

        await t.waitForVisible('.waitForVisible-test');
        const waitForVisibleTestDuration = Date.now() - waitForVisibleStart;

        t.comment('waitForVisible test duration: ' + waitForVisibleTestDuration)
        t.equal(waitForVisibleTestDuration > 2000, true)

        // @endregion

        // @region waitWhileVisible test

        const waitWhileVisibleStart = Date.now();

        await t.execFunction(function () {
            setTimeout(function () {
                $('.waitWhileVisible-test').addClass('hidden');
            }, 2000)
        })

        await t.waitWhileVisible('.waitWhileVisible-test');
        const waitWhileVisibleTestDuration = Date.now() - waitWhileVisibleStart;

        t.comment('waitWhileVisible test duration: ' + waitWhileVisibleTestDuration)
        t.equal(waitWhileVisibleTestDuration > 2000, true)

        // @endregion
    });
};
