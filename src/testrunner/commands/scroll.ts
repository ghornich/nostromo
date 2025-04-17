import { ellipsis } from '../../utils';
import Testrunner from '../testrunner';

export default async function scroll({ selector, scrollTop, testrunner, callHooks, callLifecycles }: {selector: string; scrollTop: number, testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean}) {
    testrunner._log.verbose(`scroll: "${ellipsis(selector)}", scrollTop: ${scrollTop}`);

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'scroll' });
    }

    try {
        await testrunner._currentBrowser.scroll(selector, scrollTop);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'scroll');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('scroll', { selector, scrollTop, startTime, endTime: Date.now(), success, getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'scroll' });
        }
    }
}
