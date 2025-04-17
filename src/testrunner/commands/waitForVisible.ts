import { ellipsis } from '../../utils';
import { AbortError } from '../errors';
import Testrunner from '../testrunner';

export type WaitForVisibleArgs = {
    selector: string;
    opts: {
        timeout?: number;
        initialDelay?: number;
    };
    testrunner: Testrunner;
    callHooks?: boolean;
    callLifecycles?: boolean;
};

export default async function waitForVisible({ selector, opts = {}, testrunner, callHooks = false, callLifecycles = false }: WaitForVisibleArgs) {
    if (testrunner._isAborting) {
        throw new AbortError();
    }

    testrunner._log.verbose(`waitForVisible: "${ellipsis(selector)}"`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'waitForVisible' });
    }

    try {
        await testrunner._currentBrowser.waitForVisible(selector, opts);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'waitForVisible');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('waitForVisible', { startTime, endTime: Date.now(), selector, timeout: opts.timeout, success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'waitForVisible' });
        }
    }
}
