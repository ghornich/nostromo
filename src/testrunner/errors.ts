
export class ScreenshotError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ScreenshotError';
    }
}

export class CommandError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CommandError';
    }
}

export class AbortError extends Error {
    constructor(message = '') {
        super(message);
        this.name = 'AbortError';
    }
}

export class TestFailedError extends Error {
    testErrors: (Error | string)[] | null

    constructor({ message, testErrors = null }: { message: string, testErrors?: (Error | string)[]}) {
        super(message);
        this.testErrors = testErrors ?? [];
        this.name = 'TestFailedError';
    }
}

export class BailoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BailoutError';
    }
}

export class TestBailoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TestBailoutError';
    }
}
