import { Router } from "express";
import { z } from "zod";
import { config } from "../../../config/index.js";
import { optionalJWT } from "../../../presentation/middlewares/AuthMiddleware.js";
import { prisma } from "../../../infrastructure/db/PrismaClient.js";

const getUserRestriction = async (userId) => {
  const activeBan = await prisma.moderationAction.findFirst({
    where: {
      userId,
      communityId: null,
      type: { in: ["ban", "suspend"] },
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return activeBan ? {
    isBanned: activeBan.type === "ban",
    isSuspended: activeBan.type === "suspend",
    reason: activeBan.reason,
    actionId: activeBan.id,
  } : null;
};

// Repositories & Service
import { UserRepository } from "../../user/infrastructure/repository/UserRepository.js";
import { SessionRepository } from "../infrastructure/repository/SessionRepository.js";
import { AuthService } from "../application/AuthService.js";

// Handlers
import {
  RegisterCommand,
  RegisterHandler,
} from "../application/commands/RegisterHandler.js";
import {
  LoginCommand,
  LoginHandler,
} from "../application/commands/LoginHandler.js";
import {
  OAuthSignInCommand,
  OAuthSignInHandler,
} from "../application/commands/OAuthSignInHandler.js";
import {
  RefreshTokenCommand,
  RefreshTokenHandler,
} from "../application/commands/RefreshTokenHandler.js";
import {
  VerifyEmailCommand,
  VerifyEmailHandler,
} from "../application/commands/VerifyEmailHandler.js";
import {
  RequestPasswordResetCommand,
  ResetPasswordCommand,
  RequestPasswordResetHandler,
  ResetPasswordHandler,
} from "../application/commands/PasswordResetHandler.js";
import {
  RevokeSessionCommand,
  RevokeSessionHandler,
} from "../application/commands/RevokeSessionHandler.js";

// Dependency instantiation
const userRepo = new UserRepository();
const sessionRepo = new SessionRepository();
const authService = new AuthService(sessionRepo, userRepo);

const registerHandler = new RegisterHandler(userRepo, authService);
const loginHandler = new LoginHandler(userRepo, authService);
const oauthSignInHandler = new OAuthSignInHandler(userRepo, authService);
const refreshTokenHandler = new RefreshTokenHandler(authService);
const verifyEmailHandler = new VerifyEmailHandler(userRepo);
const requestPasswordResetHandler = new RequestPasswordResetHandler(userRepo);
const resetPasswordHandler = new ResetPasswordHandler(userRepo, sessionRepo);
const revokeSessionHandler = new RevokeSessionHandler(sessionRepo, userRepo);

export function createAuthRouter() {
  const router = Router();

  // Helper to attach secure refresh token cookie
  const setRefreshTokenCookie = (res, token) => {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
    });
  };

  // Helper to clear refresh token cookie
  const clearRefreshTokenCookie = (res) => {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "strict",
    });
  };

  // 1. Register
  router.post("/register", async (req, res, next) => {
    const schema = z.object({
      username: z
        .string()
        .min(3)
        .max(30)
        .regex(
          /^[a-zA-Z0-9_]+$/,
          "Username can only contain alphanumeric characters and underscores",
        ),
      email: z.string().email(),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters long"),
      name: z.string().max(50).optional(),
      bio: z.string().max(200).optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new RegisterCommand(
        parsed.username,
        parsed.email,
        parsed.password,
        parsed.name,
        parsed.bio,
        req.headers["user-agent"],
        req.ip,
      );

      const result = await registerHandler.execute(command);
      setRefreshTokenCookie(res, result.tokens.refreshToken);

      const userRestriction = await getUserRestriction(result.user.id);

      res.status(201).json({
        success: true,
        data: {
          accessToken: result.tokens.accessToken,
          user: result.user,
          userRestriction,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 2. Login
  router.post("/login", async (req, res, next) => {
    const schema = z.object({
      identifier: z.string().min(1, "Username or email is required"),
      password: z.string().min(1, "Password is required"),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new LoginCommand(
        parsed.identifier,
        parsed.password,
        req.headers["user-agent"],
        req.ip,
      );

      const result = await loginHandler.execute(command);
      setRefreshTokenCookie(res, result.tokens.refreshToken);

      const userRestriction = await getUserRestriction(result.user.id);

      res.json({
        success: true,
        data: {
          accessToken: result.tokens.accessToken,
          user: result.user,
          userRestriction,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. OAuth Sign-In
  router.post("/oauth", async (req, res, next) => {
    const schema = z.object({
      provider: z.string().min(1),
      token: z.string().min(1),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new OAuthSignInCommand(
        parsed.provider,
        parsed.token,
        req.headers["user-agent"],
        req.ip,
      );

      const result = await oauthSignInHandler.execute(command);
      setRefreshTokenCookie(res, result.tokens.refreshToken);

      const userRestriction = await getUserRestriction(result.user.id);

      res.json({
        success: true,
        data: {
          accessToken: result.tokens.accessToken,
          user: result.user,
          userRestriction,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Refresh Token Exchange (Rotation)
  router.post("/refresh", async (req, res, next) => {
    // Read from cookie first, fallback to request body
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Refresh token is missing",
        },
      });
    }

    try {
      const command = new RefreshTokenCommand(
        refreshToken,
        req.headers["user-agent"],
        req.ip,
      );

      const result = await refreshTokenHandler.execute(command);
      setRefreshTokenCookie(res, result.refreshToken);

      const userRestriction = await getUserRestriction(result.user.id);

      res.json({
        success: true,
        data: {
          accessToken: result.accessToken,
          user: result.user,
          userRestriction,
        },
      });
    } catch (err) {
      // Invalidate cookies on token failure
      clearRefreshTokenCookie(res);
      next(err);
    }
  });

  // 5. Logout / Session Revocation
  router.post("/logout", optionalJWT, async (req, res, next) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const scope = req.body.scope || "current";

    try {
      if (req.user) {
        const command = new RevokeSessionCommand(
          req.user.id,
          scope,
          refreshToken,
        );
        await revokeSessionHandler.execute(command);
      }

      if (scope === "current" || scope === "all") {
        clearRefreshTokenCookie(res);
      }

      res.json({
        success: true,
        data: null,
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Verify Email
  router.post("/verify-email", async (req, res, next) => {
    const schema = z.object({
      token: z.string().min(1, "Token is required"),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new VerifyEmailCommand(parsed.token);
      const result = await verifyEmailHandler.execute(command);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  // 7. Request Password Reset (Forgot Password)
  router.post("/forgot-password", async (req, res, next) => {
    const schema = z.object({
      email: z.string().email(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new RequestPasswordResetCommand(parsed.email);
      const result = await requestPasswordResetHandler.execute(command);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  // 8. Reset Password
  router.post("/reset-password", async (req, res, next) => {
    const schema = z.object({
      token: z.string().min(1, "Token is required"),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters long"),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new ResetPasswordCommand(parsed.token, parsed.password);
      const result = await resetPasswordHandler.execute(command);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const authRouter = createAuthRouter();
