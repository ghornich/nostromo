import Testrunner from '../testrunner';

export default async function execFunction({ fn, args, testrunner, callHooks, callLifecycles }: {fn: Function; args: any[], testrunner: Testrunner, callHooks?: boolean; callLifecycles?: boolean}) {
    testrunner._log.verbose(`execFunction: ${fn.name || '(anonymous)'}`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'execFunction' });
    }

    try {
        return testrunner._currentBrowser.execFunction(fn, ...args);
    }
    catch (err) {
        success = false;
        throw err;
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('execFunction', { startTime, endTime: Date.now(), functionName: fn.name || '(anonymous)', success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'execFunction' });
        }
    }
}
