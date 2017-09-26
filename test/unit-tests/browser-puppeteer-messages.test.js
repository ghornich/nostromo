'use strict';

const test = require('tape');
const Promise = require('bluebird');
const Chrome = require('../../modules/browser-spawner-chrome');
const BrowserPuppeteer = require('../../modules/browser-puppeteer').BrowserPuppeteer;
const MESSAGES = require('../../modules/browser-puppeteer').MESSAGES;
const Loggr = require('../../modules/loggr');
const HttpServer = require('http-server');

const HTTP_PORT = 49309;
const testHtmlURL = `http://localhost:${HTTP_PORT}/browser-puppeteer-messages.test.html`;

test('browser puppeteer messages', async t => {
    const browser = new Chrome({
        name: 'Chrome',
        path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
    });

    const puppeteer = new BrowserPuppeteer({
        logger: new Loggr({
            namespace: 'BrowserPuppeteer',
            logLevel: Loggr.LEVELS.TRACE,
            indent: '  ',
        }),
    });

    const httpServer = HttpServer.createServer({
        root: __dirname,
        cache: -1,
        showDir: 'false',
        autoIndex: 'false',
    });

    httpServer.listen(HTTP_PORT);


    async function getScreenshotMarkerState() {
        return puppeteer.execFunction(function () {
            return document.querySelector('.browser-puppet--screenshot-marker--top-left') !== null &&
                document.querySelector('.browser-puppet--screenshot-marker--bottom-right') !== null;
        });
    }

    async function getCookies() {
        return puppeteer.execFunction(function () {
            return document.cookie;
        });
    }

    async function isLocalStorageEmpty() {
        return puppeteer.execFunction(function () {
            return localStorage.length === 0;
        });
    }

    async function assertPersistentDataEmpty() {
        t.equal(await getCookies(), '', 'ClearPersistentData: cookies are empty');
        t.equal(await isLocalStorageEmpty(), true, 'ClearPersistentData: localStorage is empty');
    }

    try {
        await puppeteer.start();
        await browser.start();

        browser.open(testHtmlURL);

        await puppeteer.waitForPuppet();

        // DOWNSTREAM

        // ExecCommandMessage

        await puppeteer.execCommand({
            type: 'setValue',
            selector: '#input',
            value: 'newInputValue',
        });

        const execCommandTestValue = await puppeteer.execCommand({ type: 'getValue', selector: '#input' });

        t.equal(execCommandTestValue, 'newInputValue', 'execCommand test');


        // ExecFunctionMessage

        const execFunctionResult = await puppeteer.execFunction(function (arg1, arg2) {
            const domTestNum = Number(document.getElementById('execFunctionTest').innerText);

            return arg1 + arg2 * domTestNum;
        }, 20, 30);

        t.equal(execFunctionResult, 2270, 'execFunction test');

        // SetSelectorBecameVisibleDataMessage

        // see UPSTREAM SelectorBecameVisibleMessage

        // ShowScreenshotMarkerMessage

        await puppeteer.showScreenshotMarker();
        t.equal(await getScreenshotMarkerState(), true, 'screenshot markers are visible');

        // HideScreenshotMarkerMessage

        await puppeteer.hideScreenshotMarker();
        t.equal(await getScreenshotMarkerState(), false, 'screenshot markers are hidden');

        // SetTransmitEventsMessage ON

        await puppeteer.setTransmitEvents(true);

        const capturedEventPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('"SetTransmitEventsMessage ON" test timed out'));
            }, 3000);

            puppeteer.once(MESSAGES.UPSTREAM.CAPTURED_EVENT, capturedEventMessage => {
                clearTimeout(timeoutId);

                if (capturedEventMessage.event.selector === '#clickTest') {
                    resolve();
                }
                else {
                    reject(new Error(`"SetTransmitEventsMessage ON" test failure: unexpected selector: "${capturedEventMessage.event.selector}"`));
                }
            });
        });

        await puppeteer.execFunction(function () {
            // can't capture programmatically while in execFunction, use setTimeout to simulate user event
            setTimeout(function () {
                document.getElementById('clickTest').click();
            }, 50);

        });

        try {
            await capturedEventPromise;
            t.ok(true, 'SetTransmitEventsMessage ON');
        }
        catch (error) {
            t.ok(false, error.message);
        }


        // SetTransmitEventsMessage OFF

        await puppeteer.setTransmitEvents(false);

        const transmitEventsValue = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._transmitEvents;
        });

        t.equal(transmitEventsValue, false, 'SetTransmitEventsMessage OFF test');

        // TerminatePuppetMessage

        await puppeteer.terminatePuppet();

        t.equal(puppeteer._wsConn, null, 'terminatePuppet wsConn is null');

        await Promise.delay(3000);

        t.equal(puppeteer._wsConn, null, 'terminatePuppet wsConn is still null (puppet didn\'t reconnect)');

        browser.open(testHtmlURL);
        await puppeteer.waitForPuppet();

        // ClearPersistentDataMessage

        await assertPersistentDataEmpty();

        await puppeteer.execFunction(function () {
            document.cookie = 'testcookie1=123;';
            document.cookie = 'testcookie2=asdf;';
            localStorage.setItem('testLS', 'testLSVal');
        });

        const hasLocalStorageItem = await puppeteer.execFunction(function () {
            return localStorage.length === 1 && localStorage.getItem('testLS') === 'testLSVal';
        });

        t.equal(await getCookies(), 'testcookie1=123; testcookie2=asdf', 'ClearPersistentData: cookies are set');
        t.equal(hasLocalStorageItem, true, 'ClearPersistentData: localStorage is set');

        await puppeteer.clearPersistentData();

        await assertPersistentDataEmpty();

        // SetMouseoverSelectorsMessage

        await puppeteer.setMouseoverSelectors(['#mouseoverTest']);

        await puppeteer.setTransmitEvents(true);

        const capturedMouseEventPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('"SetMouseoverSelectorsMessage" test timed out'));
            }, 3000);

            puppeteer.once(MESSAGES.UPSTREAM.CAPTURED_EVENT, capturedEventMessage => {
                clearTimeout(timeoutId);

                if (capturedEventMessage.event.selector === '#mouseoverTest') {
                    resolve();
                }
                else {
                    reject(new Error('"SetMouseoverSelectorsMessage" test failure: unexpected selector'));
                }
            });
        });

        await puppeteer.execFunction(function () {
            // can't capture programmatically while in execFunction, use setTimeout to simulate user event
            setTimeout(function () {
                const ev = new Event('mouseover');
                document.getElementById('mouseoverTest').dispatchEvent(ev);
            }, 50);

        });

        try {
            await capturedMouseEventPromise;
            t.ok(true, 'SetMouseoverSelectorsMessage');
        }
        catch (error) {
            t.ok(false, 'SetMouseoverSelectorsMessage ' + error.message);
        }

        await puppeteer.terminatePuppet();
        browser.open(testHtmlURL);
        await puppeteer.waitForPuppet();

        // SetIgnoredClassesMessage

        const beforeIgnoreClassesUniqueSelector = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._uniqueSelector.get(document.querySelector('.ignored-class'));
        });

        t.equal(beforeIgnoreClassesUniqueSelector, '.ignored-class', 'before setting ignored class');

        await puppeteer.sendMessage({
            type: 'set-ignored-classes',
            classes: ['ignored-class'],
        });

        const afterIgnoreClassesUniqueSelector = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._uniqueSelector.get(document.querySelector('.ignored-class'));
        });

        t.equal(afterIgnoreClassesUniqueSelector, '#ignoredClassTest > span:nth-child(2)', 'after setting ignored class');

        // UPSTREAM

        // SelectorBecameVisibleMessage

        await puppeteer.setSelectorBecameVisibleSelectors(['#selectorBecameVisibleTest']);
        await puppeteer.setTransmitEvents(true);

        const selectorBecameVisiblePromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('SelectorBecameVisibleMessage test: timed out'));
            }, 3000);

            puppeteer.once(MESSAGES.UPSTREAM.SELECTOR_BECAME_VISIBLE, data => {
                clearTimeout(timeoutId);

                if (data.selector === '#selectorBecameVisibleTest') {
                    resolve();
                }
                else {
                    reject(new Error('selectorBecameVisiblePromise: unexpected selector'));
                }
            });
        });

        await puppeteer.execFunction(function () {
            setTimeout(function () {
                document.getElementById('selectorBecameVisibleTest').setAttribute('style', '');
            }, 50);
        });

        try {
            await selectorBecameVisiblePromise;
            t.ok(true, 'selectorBecameVisiblePromise');
        }
        catch (error) {
            t.ok(false, error.message);
        }

        // CapturedEventMessage



        // AckMessage



        // NakMessage



        // InsertAssertionMessage    
    }
    catch (error) {
        t.fail(error.message);
    }
    finally {
        try {
            await browser.stop();
            await puppeteer.stop();
            httpServer.close();
        }
        catch (error) {
            console.error('Failed to stop server(s)', error);
        }

        t.end();
    }
});
