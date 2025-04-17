import { ellipsis } from '../../utils';
import { AbortError } from '../errors';
import Testrunner from '../testrunner';

export type WaitWhileVisibleArgs = {
    selector: string;
    opts: {
        timeout?: number;
        initialDelay?: number;
    };
    testrunner: Testrunner;
    callHooks?: boolean;
    callLifecycles?: boolean;
};

export default async function waitWhileVisible({ selector, opts = {}, testrunner, callHooks = false, callLifecycles = false }: WaitWhileVisibleArgs) {
    if (testrunner._isAborting) {
        throw new AbortError();
    }

    testrunner._log.verbose(`waitWhileVisible: "${ellipsis(selector)}"`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'waitWhileVisible' });
    }

    try {
        await testrunner._currentBrowser.waitWhileVisible(selector, opts);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'waitWhileVisible');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('waitWhileVisible', { startTime, endTime: Date.now(), selector, timeout: opts.timeout, success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'waitWhileVisible' });
        }
    }
}
