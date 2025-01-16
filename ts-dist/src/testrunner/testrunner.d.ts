/// <reference types="node" />
import { EventEmitter } from 'events';
import { TestrunnerConfig, TestAssertAPIDirect, TestAPI } from '../../types';
export default class Testrunner extends EventEmitter {
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
    private _ok;
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
    private setExitCode;
    private getTestApiMixinsBound;
}
