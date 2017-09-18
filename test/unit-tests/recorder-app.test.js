'use strict';

const rfr = require('rfr')
const test=require('tape')
const Chrome = rfr('modules/browser-spawner-chrome');
const RecorderServer=rfr('src/recorder/recorder-server')
const BrowserPuppeteer=rfr('modules/browser-puppeteer').BrowserPuppeteer
const MESSAGES=rfr('modules/browser-puppeteer').MESSAGES
const COMMANDS=rfr('modules/browser-puppeteer').COMMANDS

// TODO test all aspects of recorder app

test('recorder-app: composite events: defaults', async t=>{
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
                    }
                }
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
                    }
                }
            },

        ]
    })

    const browser = new Chrome({
        name: 'Chrome',
        path: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        // bounds: { size: { width: 1024, height: 750 }, position: { x: 5, y: 5 } },
    })

    await recorderServer.start()
    await browser.start()

    browser.open('http://localhost:7700')

    await new Promise(r=>setTimeout(r,10000))

    await browser.stop()
    recorderServer.stop()

    // TODO finish test

    t.end()


})
