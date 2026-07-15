import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { prisma } from "../../infrastructure/db/PrismaClient.js";
import {
  UnauthorizedError,
  ForbiddenError,
} from "../../shared/errors/AppError.js";
import { moderationActionRepository } from "../../features/moderation/infrastructure/repository/ModerationActionRepository.js";

/** Check active platform restrictions (ban or suspension) and throw ForbiddenError if not allowed */
const verifyRestrictions = async (decoded, req, res, next) => {
  // Site-wide admins bypass restrictions
  if (decoded.role === "SUPER_ADMIN" || decoded.role === "PLATFORM_ADMIN") {
    return true;
  }

  try {
    const activeBan = await moderationActionRepository.findActivePlatformBan(decoded.id);

    if (activeBan) {
      const path = req.baseUrl + req.path;
      const isAllowed =
        path.includes("/auth/logout") ||
        path.includes("/auth/refresh") ||
        path.includes("/appeals") ||
        path.includes("/users/profile") ||
        path === `/api/users/${decoded.id}`;

      if (!isAllowed) {
        res.status(403).json({
          success: false,
          error: {
            code: activeBan.type === "ban" ? "USER_BANNED" : "USER_SUSPENDED",
            message: `Your account has been ${activeBan.type}ed platform-wide: ${activeBan.reason}. You can only submit an appeal.`,
            actionId: activeBan.id,
            reason: activeBan.reason,
          },
        });
        return false;
      }
    }
  } catch (err) {
    console.error("Error checking platform restrictions:", err);
  }
  return true;
};

/** Requires a valid Bearer JWT. Throws UnauthorizedError/ForbiddenError on failures. */
export const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return next(
          new UnauthorizedError("Access token is invalid or has expired"),
        );
      }
      const allowed = await verifyRestrictions(decoded, req, res, next);
      if (allowed) {
        req.user = decoded;
        next();
      }
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
    jwt.verify(token, config.JWT_SECRET, async (err, decoded) => {
      if (!err) {
        const allowed = await verifyRestrictions(decoded, req, res, next);
        if (allowed) {
          req.user = decoded;
          next();
        }
      } else {
        next();
      }
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
