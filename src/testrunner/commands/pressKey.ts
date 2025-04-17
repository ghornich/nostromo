import Testrunner from '../testrunner';

/**
 * @param keyCode See https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts
 */
export default async function pressKey({ keyCode, testrunner, callHooks, callLifecycles }: {keyCode: string; testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean}) {
    testrunner._log.verbose(`pressKey: ${keyCode}`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'pressKey' });
    }

    try {
        if (arguments.length > 1) {
            throw new TypeError('Selector is removed, pressKey only accepts keyCode.');
        }

        if (typeof keyCode !== 'string') {
            throw new TypeError('Expected string keyCode');
        }

        await testrunner._runBrowserCommandWithRetries('pressKey', [keyCode]);
    }
    catch (err) {
        success = false;
        throw err;
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('pressKey', { startTime, endTime: Date.now(), keyCode, success, getScreenshot: testrunner.getPNGScreenshot });
        }
        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'pressKey' });
        }
    }
}
