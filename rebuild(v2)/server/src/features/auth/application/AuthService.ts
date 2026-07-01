import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../../config/index.js';
import { SessionRepository } from '../infrastructure/repository/SessionRepository.js';
import { UserRepository } from '../../user/infrastructure/repository/UserRepository.js';
import { UnauthorizedError } from '../../../shared/errors/AppError.js';
import { Logger } from '../../../shared/logger/Logger.js';

export interface TokenPayload {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly userRepo: UserRepository
  ) {}

  /**
   * Generates a short-lived access token (expires in 15 minutes).
   */
  generateAccessToken(user: { id: string; email: string; username: string; role: string }): string {
    const payload: TokenPayload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role
    };
    return jwt.sign(payload, config.JWT_SECRET, { expiresIn: '15m' });
  }

  /**
   * Creates a new session in the database and generates token pairs.
   */
  async createSession(
    userId: string,
    deviceInfo?: string,
    ipAddress?: string,
    tx?: any
  ): Promise<AuthTokens> {
    const user = await this.userRepo.findById(userId, tx);
    if (!user) {
      throw new UnauthorizedError('User profile not found during token generation');
    }

    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

    await this.sessionRepo.create({
      token: refreshToken,
      deviceInfo,
      ipAddress,
      expiresAt,
      revoked: false,
      user: { connect: { id: userId } }
    }, tx);

    const accessToken = this.generateAccessToken(user);

    return { accessToken, refreshToken };
  }

  /**
   * Executes token rotation. Exchanges a valid refresh token for a new token pair,
   * revoking the spent token. If a revoked token is presented, it flags a security threat
   * and revokes ALL active user sessions (replay attack protection).
   */
  async rotateSession(
    oldToken: string,
    deviceInfo?: string,
    ipAddress?: string,
    tx?: any
  ): Promise<AuthTokens> {
    const session = await this.sessionRepo.findByToken(oldToken, tx);
    if (!session) {
      throw new UnauthorizedError('Invalid session token');
    }

    // Security check: if the token is already revoked, trigger warning and invalidate all active sessions
    if (session.revoked || session.expiresAt < new Date()) {
      Logger.warn(`⚠️ Potential token reuse/replay attack detected! Revoking all sessions for User: ${session.userId}`);
      await this.sessionRepo.revokeAllForUser(session.userId, tx);
      throw new UnauthorizedError('Session expired or already used');
    }

    // Revoke the old token
    await this.sessionRepo.revokeSession(session.id, tx);

    // Create a new session
    return this.createSession(session.userId, deviceInfo, ipAddress, tx);
  }
}
