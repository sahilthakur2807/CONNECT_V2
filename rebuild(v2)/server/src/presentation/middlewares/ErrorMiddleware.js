import { z } from "zod";
import { AppError } from "../../shared/errors/AppError.js";
import { Logger } from "../../shared/logger/Logger.js";

export const errorMiddleware = (err, req, res, next) => {
  // If the error is a Zod validation error, translate it to standardized ValidationError format
  if (err instanceof z.ZodError) {
    const formattedDetails = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request payload validation failed",
        details: formattedDetails,
      },
    });
  }

  // Handle standard application errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle internal/unexpected server errors
  Logger.error("Unhandled server exception encountered:", err);

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected database or server error occurred",
      details: process.env.NODE_ENV === "development" ? err.stack : null,
    },
  });
};
