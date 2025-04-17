import { ellipsis } from '../../utils';
import Testrunner from '../testrunner';

export default async function scrollTo({ selector, testrunner, callHooks, callLifecycles }: {selector: string; testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean}) {
    testrunner._log.verbose(`scrollTo: "${ellipsis(selector)}"`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'scrollTo' });
    }

    try {
        await testrunner._currentBrowser.scrollIntoView(selector);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'scrollTo');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('scrollTo', { startTime, endTime: Date.now(), selector, success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'scrollTo' });
        }
    }
}
