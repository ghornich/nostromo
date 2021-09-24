export declare class ScreenshotError extends Error {
    constructor(message: string);
}
export declare class CommandError extends Error {
    constructor(message: string);
}
export declare class AbortError extends Error {
    constructor(message?: string);
}
export declare class TestFailedError extends Error {
    testErrors: (Error | string)[] | null;
    constructor({ message, testErrors }: {
        message: string;
        testErrors?: (Error | string)[];
    });
}
export declare class BailoutError extends Error {
    constructor(message: string);
}
export declare class TestBailoutError extends Error {
    constructor(message: string);
}
