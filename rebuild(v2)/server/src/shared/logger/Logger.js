import winston from "winston";
import { AsyncLocalStorage } from "async_hooks";

const { combine, timestamp, printf, colorize, json } = winston.format;

// Global context storage for tracking request lifecycles
export const loggerContextStorage = new AsyncLocalStorage();

const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const context = loggerContextStorage.getStore();
  const correlationId = context?.correlationId;
  const correlationStr = correlationId
    ? ` [CorrelationID: ${correlationId}]`
    : "";
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]${correlationStr}: ${message}${metaStr}`;
});

const prodFormat = winston.format((info) => {
  const context = loggerContextStorage.getStore();
  if (context) {
    info.correlationId = context.correlationId;
    info.userId = context.userId;
  }
  return info;
});

const internalLogger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), prodFormat()),
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? json()
          : combine(colorize(), devFormat),
    }),
  ],
});

export class Logger {
  static info(message, meta) {
    internalLogger.info(message, meta);
  }

  static warn(message, meta) {
    internalLogger.warn(message, meta);
  }

  static error(message, error, meta) {
    if (error instanceof Error) {
      internalLogger.error(message, {
        errorMessage: error.message,
        stack: error.stack,
        ...meta,
      });
    } else {
      internalLogger.error(message, { error, ...meta });
    }
  }

  static debug(message, meta) {
    internalLogger.debug(message, meta);
  }
}
