export interface Logger {
    init(consoleLogLevel: string, fileLogLevel: string, logFilePath: string): void;
    init(consoleLogLevel: string, fileLogLevel: null): void;
    init(consoleLogLevel: null, fileLogLevel: string, logFilePath: string): void;
    init(consoleLogLevel: string | null, fileLogLevel: string | null, logFilePath?: string): void;
    error(e: Error | string): void;
    warn(m: Error | string): void;
    info(m: Error | string): void;
    verbose(m: Error | string): void;
    debug(m: Error | string): void;
    childLogger(label: string): ChildLogger;
}
export declare type ChildLogger = Omit<Logger, 'init' | 'childLogger'>;
export declare const logger: Logger;
