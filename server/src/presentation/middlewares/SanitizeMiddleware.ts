import type express from 'express';
import { sanitizePayload } from '@shared/utils/Sanitizer.js';
import type { AuthenticatedRequest } from './AuthMiddleware.js';

export const sanitizeResponseMiddleware = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const originalJson = res.json;
  res.json = function (body: any) {
    const isAuthRoute = req.originalUrl.includes('/api/auth/login') || req.originalUrl.includes('/api/auth/register');
    if (!isAuthRoute && body && typeof body === 'object') {
      body = sanitizePayload(body, req.user?.role);
    }
    return originalJson.call(this, body);
  };
  next();
};
