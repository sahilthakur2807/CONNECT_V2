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
