import Testrunner from '../testrunner';

type SetFileInputArgs = {
    selector: string;
    filePath: string[];
    options?: { waitForVisible?: boolean; checkSelectorType?: boolean };
    testrunner: Testrunner;
    callHooks?: boolean;
    callLifecycles?: boolean;
};

export default async function setFileInput({ selector, filePath, options = {}, testrunner, callHooks, callLifecycles }: SetFileInputArgs) {
    testrunner._log.verbose(`setFileInput: "${selector}", "${filePath}"`);

    const opts = { ...{ waitForVisible: true, checkSelectorType: true }, ...options };

    const startTime = Date.now();
    let success = true;

    if (callLifecycles) {
        await testrunner._currentBeforeCommand?.(testrunner.directAPI, { type: 'setFileInput' });
    }

    try {
        await testrunner._runBrowserCommandWithRetries(async () => {
            if (opts.waitForVisible) {
                await testrunner._currentBrowser.waitForVisible(selector);
            }

            if (opts.checkSelectorType) {
                const isFileInput = await testrunner._currentBrowser.execFunction((s: Function) => {
                    // @ts-expect-error
                    const node = document.querySelector(s);
                    return Boolean(node && node.tagName.toLowerCase() === 'input' && node.type.toLowerCase() === 'file');
                }, selector);

                if (!isFileInput) {
                    throw new Error(`setFileInput failure: selector is not a file input: "${selector}"`);
                }
            }

            // @ts-expect-error FIXME implementation leak, don't use getPage, maybe move setFileInput to BrowserInterface
            const fileChooserPromise = (await testrunner._currentBrowser.getPage()).waitForFileChooser();
            await testrunner._currentBrowser.click(selector);
            await (await fileChooserPromise).accept(filePath);
        }, []);
    }
    catch (err) {
        success = false;
        await testrunner._handleCommandError(err, 'setFileInput');
    }
    finally {
        if (callHooks) {
            await testrunner.pluginManager.callHook('setFileInput', { selector, filePath, success, startTime, endTime: Date.now(), getScreenshot: testrunner.getPNGScreenshot });
        }

        if (callLifecycles) {
            await testrunner._currentAfterCommand?.(testrunner.directAPI, { type: 'setFileInput' });
        }
    }
}
