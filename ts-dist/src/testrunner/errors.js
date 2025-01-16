"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestBailoutError = exports.BailoutError = exports.TestFailedError = exports.AbortError = exports.CommandError = exports.ScreenshotError = void 0;
class ScreenshotError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ScreenshotError';
    }
}
exports.ScreenshotError = ScreenshotError;
class CommandError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CommandError';
    }
}
exports.CommandError = CommandError;
class AbortError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'AbortError';
    }
}
exports.AbortError = AbortError;
class TestFailedError extends Error {
    constructor({ message, testErrors = null }) {
        super(message);
        this.testErrors = testErrors !== null && testErrors !== void 0 ? testErrors : [];
        this.name = 'TestFailedError';
    }
}
exports.TestFailedError = TestFailedError;
class BailoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BailoutError';
    }
}
exports.BailoutError = BailoutError;
class TestBailoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TestBailoutError';
    }
}
exports.TestBailoutError = TestBailoutError;
