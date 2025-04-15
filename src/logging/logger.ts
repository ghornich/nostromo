import winston from 'winston';
import moment from 'moment';
import os from 'os';

export interface Logger {
    init(consoleLogLevel: string, fileLogLevel: string, logFilePath: string): void;
    init(consoleLogLevel: string, fileLogLevel: null): void;
    init(consoleLogLevel: null, fileLogLevel: string, logFilePath: string): void;
    init(consoleLogLevel: string | null, fileLogLevel: string | null, logFilePath?: string): void;
    error(e: Error | string, ...args: any[]): void;
    warn(m: Error | string): void;
    info(m: Error | string): void;
    verbose(m: Error | string): void;
    debug(m: Error | string): void;
    childLogger(label: string): ChildLogger;
}

export type ChildLogger = Omit<Logger, 'init' | 'childLogger'>;

class WinstonLogger implements Logger {
    private _logger: winston.Logger = null;

    init(consoleLogLevel: string, fileLogLevel: string, logFilePath: string);
    init(consoleLogLevel: string, fileLogLevel: null);
    init(consoleLogLevel: null, fileLogLevel: string, logFilePath: string);
    init(consoleLogLevel: string | null, fileLogLevel: string | null, logFilePath?: string) {

        const addStackToMessage = winston.format(info => {
            if (info.stack) {
                info.message = info.message + os.EOL + info.stack;
            }

            return info;
        });

        const formatLine = winston.format.printf(info => {
            return `${moment(info.timestamp).format('\\[HH:mm:ss:SSS\\]')} ${info.level} [${info.label}] ${info.message}`;
        });

        const transports: winston.transport[] = [];

        if (consoleLogLevel) {
            transports.push(new winston.transports.Console({
                level: consoleLogLevel,
                // per-transport level format is appended to the global one
                format: winston.format.combine(winston.format.colorize(), formatLine),
            }));
        }

        if (fileLogLevel) {
            transports.push(new winston.transports.File({
                filename: logFilePath,
                // per-transport level format is appended to the global one
                format: winston.format.combine(addStackToMessage(), formatLine),
                level: fileLogLevel,
            }));
        }

        /* Multiple initialization should be possible. This is for allowing
         * Testrunner to initialize the logger after it has been imported by
         * other random modules in the user config. */
        if (!this._logger) {
            this._logger = winston.createLogger({
                // winston.format.errors breaks when defined at per-transport level
                // https://github.com/winstonjs/winston/issues/1880
                // https://github.com/winstonjs/winston-transport/pull/70
                format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.timestamp()),
                transports,
            });
        }
        else {
            this._logger.clear();
            for (const t of transports) {
                this._logger.add(t);
            }
        }
    }

    error(e: Error | string, ...args: any[]) {
        if (this._logger) {
            // @ts-expect-error
            this._logger.error(e, ...args);
        }
    }

    warn(m: Error | string) {
        if (this._logger) {
            this._logger.warn(m);
        }
    }

    info(m: Error | string) {
        if (this._logger) {
            this._logger.info(m);
        }
    }

    verbose(m: Error | string) {
        if (this._logger) {
            this._logger.verbose(m);
        }
    }

    debug(m: Error | string) {
        if (this._logger) {
            this._logger.debug(m);
        }
    }

    childLogger(label: string) {
        return this._logger.child({ label });
    }
}

export const logger: Logger = new WinstonLogger();

logger.init('info', null);
