import crypto from "crypto";
import { loggerContextStorage, Logger } from "../../shared/logger/Logger.js";

export const loggingMiddleware = (req, res, next) => {
  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("x-correlation-id", correlationId);

  const context = {
    correlationId,
    // userId will be appended after jwt authentication if available
  };

  loggerContextStorage.run(context, () => {
    const startTime = process.hrtime();
    Logger.info(`Incoming request: ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.on("finish", () => {
      const diff = process.hrtime(startTime);
      const durationMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(2);

      Logger.info(
        `Request completed: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} in ${durationMs}ms`,
        {
          statusCode: res.statusCode,
          durationMs,
        },
      );
    });

    next();
  });
};
