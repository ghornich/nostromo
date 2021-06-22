/// <reference types="node" />
import { EventEmitter } from 'events';
import type { IBrowser } from '../../modules/browsers/browser-interface';
import type { ImageDiffOptions } from '../../modules/buffer-image-diff/image-diff';
declare const TEST_STATE: {
    readonly SCHEDULED: "scheduled";
    readonly PASSED: "passed";
    readonly FAILED: "failed";
};
declare type TestState = typeof TEST_STATE[keyof typeof TEST_STATE];
declare class AssertError extends Error {
    constructor(message: string);
}
declare class AbortError extends Error {
    constructor(message?: string);
}
/**
 * test assert API (without before/after side effects, "directAPI")
 */
interface TestAssertAPIDirect {
    getValue: Testrunner['_getValueDirect'];
    setValue: Testrunner['_setValueDirect'];
    setFileInput: Testrunner['_setFileInputDirect'];
    click: Testrunner['_clickDirect'];
    waitForVisible: Testrunner['_waitForVisibleDirect'];
    waitWhileVisible: Testrunner['_waitWhileVisibleDirect'];
    isVisible: Testrunner['_isVisibleDirect'];
    focus: Testrunner['_focusDirect'];
    scroll: Testrunner['_scrollDirect'];
    scrollTo: Testrunner['_scrollToDirect'];
    delay: Testrunner['_delay'];
    comment: Testrunner['_comment'];
    /** @deprecated Use screenshot instead */
    assert: Testrunner['_screenshot'];
    screenshot: Testrunner['_screenshot'];
    pressKey: Testrunner['_pressKeyDirect'];
    mouseover: Testrunner['_mouseoverDirect'];
    execFunction: Testrunner['_execFunctionDirect'];
    execCommands: Testrunner['_execCommandsDirect'];
}
interface BeforeAfterCommandCallback {
    (t: TestAssertAPIDirect, command?: {
        type: Command['type'];
    }): Promise<void>;
}
interface DirectAPICallback {
    (t: TestAssertAPIDirect): Promise<void>;
}
interface TestrunnerCallback {
    (testrunner: Testrunner): Promise<void>;
}
export interface Suite {
    name: string;
    appUrl: string;
    /** relative/absolute paths and/or globs */
    testFiles?: string[];
    tests?: Test[];
    beforeSuite?: Function;
    afterSuite?: Function;
    beforeTest?: Function;
    afterTest?: Function;
    beforeCommand?: BeforeAfterCommandCallback;
    beforeFirstCommand?: BeforeAfterCommandCallback;
    afterCommand?: BeforeAfterCommandCallback;
    afterLastCommand?: DirectAPICallback;
    beforeAssert?: DirectAPICallback;
    afterAssert?: DirectAPICallback;
}
interface Test {
    name: string;
    id: string;
    testFn: TestFn;
    state?: TestState;
    runErrors?: Error[];
}
export interface TestFn {
    (t: TestAPI, options: {
        suite: Suite;
        directAPI: TestAssertAPIDirect;
        browser: IBrowser;
    }): Promise<void>;
}
interface screenshotItem {
    errorImage: {
        path: string;
        relativePath: string;
    };
    diffImage: {
        path: string;
        relativePath: string;
    };
    referenceImage: {
        path: string;
        relativePath: string;
    };
    attempt: number;
    assertIndex: number;
    testName: string;
}
export interface TestRunReport {
    screenshots: screenshotItem[];
    testsCount: number | null;
    passedCount: number | null;
    failedCount: number | null;
    failedTestNames: string[];
    runTimeMs: number | null;
    runtimes: Record<string, number>;
    passed: boolean;
}
declare type Level = 'verbose' | 'debug' | 'info' | 'warn' | 'error';
export interface TestrunnerConfig {
    fileLogLevel: Level;
    consoleLogLevel: Level;
    /** Bailout from a single test if an assert fails */
    testBailout: boolean;
    /** Bailout from the entire test program if an assert fails */
    bailout: boolean;
    referenceScreenshotsDir: string;
    referenceErrorsDir: string;
    referenceDiffsDir: string;
    workspaceDir: string;
    browsers: IBrowser[];
    /** options for the built-in, screenshot-based asserter */
    imageDiffOptions: ImageDiffOptions;
    suites: Suite[];
    assertRetryCount: number;
    assertRetryInterval: number;
    /** regular expression string */
    testFilter: string;
    outStream: import('stream').Writable;
    /** retry failed tests n times */
    testRetryCount: number;
    /** retry failed tests only if test name matches this filter */
    testRetryFilter: RegExp;
    commandRetryCount: number;
    commandRetryInterval: number;
    onCommandError: TestrunnerCallback;
    onAssertError: TestrunnerCallback;
    exitTimeout: number;
}
interface TestAPI extends TestAssertAPIDirect {
    equal: Testrunner['_equal'];
    equals: Testrunner['_equal'];
}
interface Command {
    type: keyof TestAssertAPIDirect;
    selector: string;
    value?: any;
    pollInterval?: number;
    timeout?: number;
    initialDelay?: number;
}
declare class Testrunner extends EventEmitter {
    private _conf;
    private _log;
    private _isRunning;
    private _isAborting;
    private _assertCount;
    private _foundTestsCount;
    private _okTestsCount;
    private _testRunReport;
    private _currentTest;
    private _currentBeforeCommand;
    private _currentAfterCommand;
    private _currentBeforeAssert;
    private _currentAfterAssert;
    private _currentBrowser;
    directAPI: TestAssertAPIDirect;
    sideEffectAPI: TestAssertAPIDirect;
    tAPI: TestAPI;
    static AbortError: typeof AbortError;
    static AssertError: typeof AssertError;
    constructor(conf: Partial<TestrunnerConfig>);
    run(): Promise<void>;
    abort(): Promise<void>;
    isRunning(): boolean;
    private _runBrowsers;
    private _runSuites;
    private _runSuite;
    private _runTestWithRetries;
    private _runTest;
    private _runTestCore;
    private _parseSuiteTestfiles;
    private _parseTestFiles;
    private _wrapFunctionWithSideEffects;
    private _execCommandWithAPI;
    private _execCommandDirect;
    private _execCommandSideEffect;
    private _execCommandsDirect;
    private _execCommandsSideEffect;
    private _runBrowserCommandWithRetries;
    private _equal;
    private _clickDirect;
    private _getValueDirect;
    private _setValueDirect;
    private _setFileInputDirect;
    /**
     * @param keyCode See https://github.com/puppeteer/puppeteer/blob/main/src/common/USKeyboardLayout.ts
     */
    private _pressKeyDirect;
    private _waitForVisibleDirect;
    private _waitWhileVisibleDirect;
    private _isVisibleDirect;
    private _focusDirect;
    private _scrollDirect;
    private _scrollToDirect;
    private _mouseoverDirect;
    private _execFunctionDirect;
    private _delay;
    private _comment;
    private _handleCommandError;
    private _screenshot;
    private _runCurrentAfterAssertTasks;
    private _startExitTimeout;
}
export default Testrunner;
