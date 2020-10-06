'use strict';

const Chromium = require('../../modules/browser-spawner-chromium');
const BrowserPuppeteer = require('../../modules/browser-puppeteer/src/puppeteer/browser-puppeteer');
const MESSAGES = require('../../modules/browser-puppeteer/src/messages');
const Loggr = require('../../modules/loggr');
const http = require('http-server');

const HTTP_PORT = 49309;
const testHtmlURL = `http://localhost:${HTTP_PORT}/browser-puppeteer-messages.test.html`;

test('browser puppeteer messages', async () => {
    const browser = new Chromium({
        name: 'Chrome',
        width: 1024,
        height: 750,
    });

    const puppeteer = new BrowserPuppeteer({
        logger: new Loggr({
            namespace: 'BrowserPuppeteer',
            logLevel: Loggr.LEVELS.OFF,
            indent: '  ',
        }),
    });

    const httpServer = http.createServer({
        root: __dirname,
        cache: -1,
        showDir: 'false',
        autoIndex: 'false',
    });

    httpServer.listen(HTTP_PORT);

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
        expect(await getCookies()).toBe(''); // ClearPersistentData: cookies are empty
        expect(await isLocalStorageEmpty()).toBe(true); // ClearPersistentData: localStorage is empty
    }

    try {
        await puppeteer.start();
        await browser.start();
        await browser.waitForBrowserVisible();
        await browser.open(testHtmlURL);
        await puppeteer.waitForConnection();

        // DOWNSTREAM

        // ExecCommandMessage

        await puppeteer.execCommand({
            type: 'setValue',
            selector: '#input',
            value: 'newInputValue',
        });

        const execCommandTestValue = await puppeteer.execCommand({ type: 'getValue', selector: '#input' });

        expect(execCommandTestValue).toBe('newInputValue');


        // ExecFunctionMessage

        const execFunctionResult = await puppeteer.execFunction(function (arg1, arg2) {
            const domTestNum = Number(document.getElementById('execFunctionTest').innerText);

            return arg1 + arg2 * domTestNum;
        }, 20, 30);

        expect(execFunctionResult).toBe(2270);

        // SetSelectorBecameVisibleDataMessage
        // see UPSTREAM SelectorBecameVisibleMessage

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
        }
        catch (error) {
            console.error(error);
            expect(false).toBe(true);
        }


        // SetTransmitEventsMessage OFF

        await puppeteer.setTransmitEvents(false);

        const transmitEventsValue = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._transmitEvents;
        });

        expect(transmitEventsValue).toBe(false); // SetTransmitEventsMessage OFF test

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

        expect(await getCookies()).toBe('testcookie1=123; testcookie2=asdf');
        expect(hasLocalStorageItem).toBe(true);

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
        }
        catch (error) {
            console.error(error);
            expect(false).toBe(true);
        }

        await browser.open(testHtmlURL);
        await puppeteer.waitForConnection();

        // SetIgnoredClassesMessage

        const beforeIgnoreClassesUniqueSelector = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._uniqueSelector.get(document.querySelector('.ignored-class'));
        });

        expect(beforeIgnoreClassesUniqueSelector).toBe('.ignored-class');

        await puppeteer.sendMessage({
            type: 'set-ignored-classes',
            classes: ['ignored-class'],
        });

        const afterIgnoreClassesUniqueSelector = await puppeteer.execFunction(function () {
            // eslint-disable-next-line no-undef
            return browserPuppet._uniqueSelector.get(document.querySelector('.ignored-class'));
        });

        expect(afterIgnoreClassesUniqueSelector).toBe('#ignoredClassTest > span:nth-child(2)');

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
        }
        catch (error) {
            console.error(error);
            expect(false).toBe(true);
        }

        // CapturedEventMessage



        // AckMessage



        // NakMessage



        // InsertAssertionMessage

        // TODO check for reconnection bugs
    }
    catch (error) {
        console.error(error);
        expect(false).toBe(true);
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
    }
}, 120 * 1000);
