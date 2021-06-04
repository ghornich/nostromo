import winston from 'winston';
import moment from 'moment';
import os from 'os';


const addStackToMessage = winston.format(info => { 
    if (info.stack) {
        info.message = info.message + os.EOL + info.stack;
    }

    return info;
})

const formatLine = winston.format.printf(info => {
    return `${moment(info.timestamp).format('\\[HH:mm:ss:SSS\\]')} ${info.level} [${info.label}] ${info.message}`;
});

export function createLogger(consoleLogLevel: string, fileLogLevel: string, logFilePath: string);
export function createLogger(consoleLogLevel: string, fileLogLevel: null);
export function createLogger(consoleLogLevel: null, fileLogLevel: string, logFilePath: string);
export function createLogger(consoleLogLevel: string | null, fileLogLevel: string | null, logFilePath?: string) {

    const transports: winston.transport[] = [];

    if (consoleLogLevel) {
        transports.push(new winston.transports.Console({
            level: consoleLogLevel,
            // per-transport level format is appended to the global one
            format: winston.format.combine(winston.format.colorize(), formatLine)
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

    return winston.createLogger({
        defaultMeta: { label: 'Testrunner' },
        // winston.format.errors breaks when defined at per-transport level
        // https://github.com/winstonjs/winston/issues/1880
        // https://github.com/winstonjs/winston-transport/pull/70
        format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.timestamp()),
        transports
    });
}