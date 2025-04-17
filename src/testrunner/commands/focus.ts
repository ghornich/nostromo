import { ellipsis } from '../../utils';
import Testrunner from '../testrunner';

export default async function focus({ selector, testrunner, callHooks, callLifecycles }: {selector: string; testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean}) {
    testrunner._log.verbose(`focus: "${ellipsis(selector)}"`);

    const startTime = Date.now();
    // let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'focus' });
    }

    try {
        await testrunner._currentBrowser.focus(selector);
    }
    catch (err) {
        // ignore failure for focus
        // success = false;
        // TODO handle as error?
        testrunner._log.warn(`WARNING - focus failed - ${err.message}`);
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('focus', { selector, success: true, startTime, endTime: Date.now(), getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'focus' });
        }
    }
}
