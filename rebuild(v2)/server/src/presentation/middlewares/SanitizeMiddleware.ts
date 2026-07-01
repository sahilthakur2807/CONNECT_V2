import type express from 'express';
import { sanitizeRequestData } from '../../shared/utils/Sanitizer.js';

export const sanitizeRequestMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeRequestData(req.body);
  }
  next();
};
