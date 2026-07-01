import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";

/** Requires a valid Bearer JWT. Throws UnauthorizedError/ForbiddenError on failures. */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(
          new ForbiddenError("Access token is invalid or has expired"),
        );
      }
      req.user = decoded;
      next();
    });
  } else {
    next(new UnauthorizedError("Authentication token is missing"));
  }
};

/** Attaches user to the request if a token is present, but never blocks. */
export const optionalJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    jwt.verify(token, config.JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
};

/** Role authorization guard middleware. Runs after authenticateJWT. */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError("Authentication required"));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ForbiddenError("You do not have permission to perform this action"),
      );
    }
    next();
  };
};
