import Testrunner from '../testrunner';

export default async function click({ selector, testrunner, callHooks, callLifecycles }: {selector: string; testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean}) {
    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'click' });
    }

    try {
        await testrunner._runBrowserCommandWithRetries('click', [selector]);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'click');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('click', { startTime, endTime: Date.now(), selector, success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'click' });
        }
    }
}
