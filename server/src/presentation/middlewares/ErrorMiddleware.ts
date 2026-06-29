import type express from 'express';
import { AppError } from '@shared/errors/AppError.js';
import { Logger } from '@shared/logger/Logger.js';

export const errorMiddleware = (
  err: Error,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details
    });
  }

  Logger.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'An unexpected error occurred'
  });
};
