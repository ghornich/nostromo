import { logger } from '../../logging/logger';
import { ellipsis } from '../../utils';
import { AbortError } from '../errors';
import Testrunner from '../testrunner';

export default async function waitWhileVisible({ selector, opts = {}, testrunner, callHooks = false, callLifecycles = false }: { testrunner: Testrunner, selector: string, opts?: {timeout?: number}, callHooks?: boolean, callLifecycles?: boolean }) {
    if (testrunner._isAborting) {
        throw new AbortError();
    }

    logger.verbose(`waitWhileVisible: "${ellipsis(selector)}"`);

    const startTime = Date.now();
    let result;

    if (callLifecycles) {
        await this._currentBeforeCommand?.(this.directAPI, { type: 'waitWhileVisible' });
    }

    try {
        result = await this._currentBrowser.waitWhileVisible(selector, opts);

        if (callHooks) {
            await testrunner.pluginManager.callHook('waitWhileVisible', { startTime, endTime: Date.now(), selector, timeout: opts.timeout, success: true, getScreenshot: this.getPNGScreenshot });
        }
    }
    catch (err) {
        if (callHooks) {
            await testrunner.pluginManager.callHook('waitWhileVisible', { startTime, endTime: Date.now(), selector, timeout: opts.timeout, success: false, getScreenshot: testrunner.getPNGScreenshot });
        }

        await testrunner._handleCommandError(err, 'waitWhileVisible');
    }

    if (callLifecycles) {
        await this._currentAfterCommand?.(this.directAPI, { type: 'waitWhileVisible' });
    }

    return result;
}
