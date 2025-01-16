import type { ImageDiffOptions } from './modules/buffer-image-diff/image-diff';
import type { IBrowser } from './modules/browsers/browser-interface';
import type Testrunner from './src/testrunner';
import { TEST_STATE } from './constants';
import type { PuppeteerLifeCycleEvent } from 'puppeteer';

type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

interface TestrunnerCallback {
    (testrunner: Testrunner): Promise<void>
}

type TestState = typeof TEST_STATE[keyof typeof TEST_STATE];

interface TestFn {
    (t: TestAPI, options: { suite: Suite, directAPI: TestAssertAPIDirect, browser: IBrowser }): Promise<void>
}

interface BeforeAfterCommandCallback {
    (t: TestAssertAPIDirect, command?: { type: Command['type'] }): Promise<void>
}

interface DirectAPICallback {
    (t: TestAssertAPIDirect): Promise<void>
}

interface screenshotItem {
    errorImage: { path: string, relativePath: string }
    diffImage: { path: string, relativePath: string }
    referenceImage: { path: string, relativePath: string }
    attempt: number
    assertIndex: number
    testName: string
}

interface TestRunReport {
    screenshots: screenshotItem[]
    testsCount: number | null
    passedCount: number | null
    failedCount: number | null
    failedTestNames: string[]
    runTimeMs: number | null
    runtimes: Record<string, number>
    passed: boolean
}

interface TestAPI extends TestAssertAPIDirect {
    equal: Testrunner['_equal']
    equals: Testrunner['_equal'],
    ok: Testrunner['_ok'],
    mixins: { [key: string]: any }
}

interface Command {
    type: keyof TestAssertAPIDirect;
    selector: string;
    value?: any;
    pollInterval?: number;
    timeout?: number;
    initialDelay?: number;
}

interface Test {
    name: string
    id: string
    testFn: TestFn
    state?: TestState
    runErrors?: (Error | string)[]
}

/**
 * test assert API (without before/after side effects, "directAPI")
 */
 interface TestAssertAPIDirect {
    getValue: Testrunner['_getValueDirect']
    setValue: Testrunner['_setValueDirect']
    setFileInput: Testrunner['_setFileInputDirect']
    click: Testrunner['_clickDirect']
    waitForVisible: Testrunner['_waitForVisibleDirect']
    waitWhileVisible: Testrunner['_waitWhileVisibleDirect']
    isVisible: Testrunner['_isVisibleDirect']
    focus: Testrunner['_focusDirect']
    scroll: Testrunner['_scrollDirect']
    scrollTo: Testrunner['_scrollToDirect']
    delay: Testrunner['_delay']
    comment: Testrunner['_comment']
    /** @deprecated Use screenshot instead */
    assert: Testrunner['_screenshot']
    screenshot: Testrunner['_screenshot']
    pressKey: Testrunner['_pressKeyDirect']
    mouseover: Testrunner['_mouseoverDirect']
    execFunction: Testrunner['_execFunctionDirect']
    execCommands: Testrunner['_execCommandsDirect']
}

interface Suite {
    name: string
    appUrl: string
    waitUntil?: PuppeteerLifeCycleEvent
    /** relative/absolute paths and/or globs */
    testFiles?: string[]
    tests?: Test[]
    beforeSuite?: Function
    afterSuite?: Function
    beforeTest?: Function
    afterTest?: Function
    beforeCommand?: BeforeAfterCommandCallback
    beforeFirstCommand?: BeforeAfterCommandCallback
    afterCommand?: BeforeAfterCommandCallback
    afterLastCommand?: DirectAPICallback
    beforeAssert?: DirectAPICallback
    afterAssert?: DirectAPICallback
}

interface TestrunnerConfig {
    fileLogLevel?: LogLevel,
    consoleLogLevel?: LogLevel,
    /** Bailout from a single test if an assert fails */
    testBailout?: boolean
    /** Bailout from the entire test program if an assert fails */
    bailout?: boolean
    referenceScreenshotsDir?: string
    referenceErrorsDir?: string
    referenceDiffsDir?: string
    workspaceDir?: string
    browsers: IBrowser[]
    /** options for the built-in, screenshot-based asserter */
    imageDiffOptions?: ImageDiffOptions
    suites: Suite[]
    assertRetryCount?: number
    assertRetryInterval?: number
    /** regular expression string */
    testFilter?: string
    /** retry failed tests n times */
    testRetryCount?: number
    /** retry failed tests only if test name matches this filter */
    testRetryFilter?: RegExp
    commandRetryCount?: number
    commandRetryInterval?: number
    onCommandError?: TestrunnerCallback
    onAssertError?: TestrunnerCallback
    exitTimeout?: number,
    testApiMixins?: { [key: string]: any }
}
