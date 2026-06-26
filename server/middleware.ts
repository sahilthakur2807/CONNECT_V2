import express from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'newsconnect-secret-key-change-in-production';

export interface AuthenticatedRequest extends express.Request {
  user?: {
    id: string;
    email: string;
    username: string;
    role: string;
  };
}

export function sanitizeUserForClient(user: any, requesterRole?: string) {
  if (!user) return user;

  const targetRole = user.role;
  let shouldSanitize = false;

  if (targetRole === 'superadmin') {
    // Only superadmin can see superadmin
    if (requesterRole !== 'superadmin') {
      shouldSanitize = true;
    }
  } else if (targetRole === 'admin') {
    // Only superadmin and admin can see admin
    if (requesterRole !== 'superadmin' && requesterRole !== 'admin') {
      shouldSanitize = true;
    }
  }

  if (shouldSanitize) {
    const sanitized = { ...user };
    sanitized.role = 'user';
    if (sanitized.badges) {
      sanitized.badges = sanitized.badges.filter((b: string) => {
        const lower = b.toLowerCase();
        return !lower.includes('admin') && !lower.includes('super');
      });
    }
    return sanitized;
  }

  return user;
}

export function sanitizePayload(data: any, requesterRole?: string): any {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizePayload(item, requesterRole));
  }

  if (typeof data === 'object') {
    if ('role' in data && ('username' in data || 'email' in data || 'avatar' in data)) {
      const sanitizedUser = sanitizeUserForClient(data, requesterRole);
      const result: any = {};
      for (const key of Object.keys(sanitizedUser)) {
        result[key] = sanitizePayload(sanitizedUser[key], requesterRole);
      }
      return result;
    }

    const result: any = {};
    for (const key of Object.keys(data)) {
      result[key] = sanitizePayload(data[key], requesterRole);
    }
    return result;
  }

  return data;
}

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

/** Requires a valid Bearer JWT – returns 401/403 otherwise. */
export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) return res.status(403).json({ error: 'Forbidden' });
      req.user = decoded as any;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

/** Attaches user to the request if a token is present, but never blocks. */
export const optionalJWT = (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded as any;
      next();
    });
  } else {
    next();
  }
};

