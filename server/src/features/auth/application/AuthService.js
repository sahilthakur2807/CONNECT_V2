import jwt from "jsonwebtoken";
import crypto from "crypto";
import { config } from "../../../config/index.js";
import { UnauthorizedError } from "../../../shared/errors/AppError.js";
import { Logger } from "../../../shared/logger/Logger.js";

export class AuthService {
  constructor(sessionRepo, userRepo) {
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
  }

  /**
   * Generates a short-lived access token (expires in 15 minutes).
   */
  generateAccessToken(user) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };
    return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "15m" });
  }

  /**
   * Creates a new session in the database and generates token pairs.
   */
  async createSession(userId, deviceInfo, ipAddress, tx) {
    const user = await this.userRepo.findById(userId, tx);
    if (!user) {
      throw new UnauthorizedError(
        "User profile not found during token generation",
      );
    }

    const refreshToken = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // Expires in 3 days

    await this.sessionRepo.create(
      {
        token: refreshToken,
        deviceInfo,
        ipAddress,
        expiresAt,
        revoked: false,
        user: { connect: { id: userId } },
      },
      tx,
    );

    const accessToken = this.generateAccessToken(user);
    const { password: _, verificationToken: __, ...sanitizedUser } = user;

    return { accessToken, refreshToken, user: sanitizedUser };
  }

  /**
   * Executes token rotation. Exchanges a valid refresh token for a new token pair,
   * revoking the spent token. If a revoked token is presented, it flags a security threat
   * and revokes ALL active user sessions (replay attack protection).
   */
  async rotateSession(oldToken, deviceInfo, ipAddress, tx) {
    const session = await this.sessionRepo.findByToken(oldToken, tx);
    if (!session) {
      throw new UnauthorizedError("Invalid session token");
    }

    // Security check: if the token is already revoked, trigger warning and invalidate all active sessions
    if (session.revoked) {
      Logger.warn(
        `⚠️ Potential token reuse/replay attack detected! Revoking all sessions for User: ${session.userId}`,
      );
      await this.sessionRepo.revokeAllForUser(session.userId, tx);
      throw new UnauthorizedError("Session compromised");
    }

    // Normal session expiration check
    if (session.expiresAt < new Date()) {
      await this.sessionRepo.revokeSession(session.id, tx);
      throw new UnauthorizedError("Session expired");
    }

    // Revoke the old token
    await this.sessionRepo.revokeSession(session.id, tx);

    // Create a new session
    return this.createSession(session.userId, deviceInfo, ipAddress, tx);
  }
}
