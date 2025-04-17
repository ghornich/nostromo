import { ellipsis } from '../../utils';
import Testrunner from '../testrunner';

type SetValueArgs = {
    selector: string;
    value: string;
    testrunner: Testrunner;
    callHooks?: boolean;
    callLifecycles?: boolean;
};

export default async function setValue({ selector, value, testrunner, callHooks = false, callLifecycles = false }: SetValueArgs) {
    testrunner._log.verbose(`setValue: "${ellipsis(value)}", "${ellipsis(selector)}"`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'setValue' });
    }

    try {
        await testrunner._runBrowserCommandWithRetries(async () => {
            // @ts-expect-error
            await testrunner._currentBrowser.execFunction((s) => document.querySelector(s).select(), selector);
            await testrunner._currentBrowser.type(selector, value);
        }, []);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'setValue');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('setValue', { startTime, endTime: Date.now(), selector, value, success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'waitWhileVisible' });
        }
    }
}
