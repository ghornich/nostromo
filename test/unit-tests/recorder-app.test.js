'use strict';

const rfr = require('rfr');
const Chromium = require('../../modules/browser-spawner-chromium');
const RecorderServer = rfr('src/recorder/recorder-server');
const MESSAGES = rfr('modules/browser-puppeteer').MESSAGES;

// TODO test all aspects of recorder app

test('recorder-app: composite events: defaults', async () => {
    const recorderServer = new RecorderServer({
        _preEnableRecording: true,
        _mockMessages: [

            /*
                1. click, 10ms, focus - similar fullPaths
                2. click, 10ms, focus - different fullPaths
                3. click, 1s, focus - similar fullPaths
                4. click, 1s, focus - different fullPaths
             */

            // 1. click, 10ms, focus - similar fullPaths
            {
                type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
                event: {
                    type: 'click',
                    $timestamp: 1000,
                    selector: '.a span',
                    $fullSelectorPath: 'div .a span',
                    target: {
                        className: '', id: '', innerText: '', tagName: 'SPAN', type: '',
                    },
                },
            },
            {
                type: MESSAGES.UPSTREAM.CAPTURED_EVENT,
                event: {
                    type: 'focus',
                    $timestamp: 1010,
                    selector: '.a',
                    $fullSelectorPath: 'div .a',
                    target: {
                        className: 'a', id: '', innerText: '', tagName: 'DIV', type: '',
                    },
                },
            },

        ],
    });

    const browser = new Chromium({
        name: 'Chrome',
        width: 1024,
        height: 750,
    });

    // await recorderServer.start()
    // await browser.start()

    // browser.open('http://localhost:7700')

    // await new Promise(r=>setTimeout(r,10000))

    // await browser.stop()
    // recorderServer.stop()

    // TODO finish test
});
