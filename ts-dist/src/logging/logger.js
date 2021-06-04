"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const moment_1 = __importDefault(require("moment"));
const os_1 = __importDefault(require("os"));
const addStackToMessage = winston_1.default.format(info => {
    if (info.stack) {
        info.message = info.message + os_1.default.EOL + info.stack;
    }
    return info;
});
const formatLine = winston_1.default.format.printf(info => {
    return `${moment_1.default(info.timestamp).format('\\[HH:mm:ss:SSS\\]')} ${info.level} [${info.label}] ${info.message}`;
});
function createLogger(consoleLogLevel, fileLogLevel, logFilePath) {
    const transports = [];
    if (consoleLogLevel) {
        transports.push(new winston_1.default.transports.Console({
            level: consoleLogLevel,
            // per-transport level format is appended to the global one
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), formatLine)
        }));
    }
    if (fileLogLevel) {
        transports.push(new winston_1.default.transports.File({
            filename: logFilePath,
            // per-transport level format is appended to the global one
            format: winston_1.default.format.combine(addStackToMessage(), formatLine),
            level: fileLogLevel,
        }));
    }
    return winston_1.default.createLogger({
        defaultMeta: { label: 'Testrunner' },
        // winston.format.errors breaks when defined at per-transport level
        // https://github.com/winstonjs/winston/issues/1880
        // https://github.com/winstonjs/winston-transport/pull/70
        format: winston_1.default.format.combine(winston_1.default.format.errors({ stack: true }), winston_1.default.format.timestamp()),
        transports
    });
}
exports.createLogger = createLogger;
