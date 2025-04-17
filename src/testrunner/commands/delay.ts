import delay from '../../../modules/delay/delay';
import Testrunner from '../testrunner';

export default async function delayCmd({ amount, testrunner, callHooks, callLifecycles }: { amount: number; testrunner: Testrunner; callHooks?: boolean; callLifecycles?: boolean }) {
    testrunner._log.verbose(`delay ${amount}`);

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'delay' });
    }

    const startTime = Date.now();

    await delay(amount);

    if (callLifecycles) {
        await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'delay' });
    }

    if (callHooks) {
        await testrunner.pluginManager.callHook('delay', { startTime, endTime: Date.now(), amount, getScreenshot: testrunner.getPNGScreenshot, success: true });
    }
}
