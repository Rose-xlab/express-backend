"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = __importDefault(require("../config"));
const { combine, timestamp, printf, colorize } = winston_1.default.format;
const logFormat = printf(({ level, message, timestamp, context, ...meta }) => {
    const contextStr = context ? `[${context}]` : '';
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} ${level} ${contextStr}: ${message}${metaStr}`;
});
const logger = winston_1.default.createLogger({
    level: config_1.default.logging.level,
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error'
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log'
        })
    ]
});
function createLogger(context) {
    return {
        debug: (message, meta = {}) => {
            logger.debug(message, { context, ...meta });
        },
        info: (message, meta = {}) => {
            logger.info(message, { context, ...meta });
        },
        warn: (message, meta = {}) => {
            logger.warn(message, { context, ...meta });
        },
        error: (message, error, meta = {}) => {
            logger.error(message, {
                context,
                ...meta,
                ...(error && {
                    errorMessage: error.message,
                    stack: error.stack
                })
            });
        }
    };
}
exports.createLogger = createLogger;
exports.default = logger;
