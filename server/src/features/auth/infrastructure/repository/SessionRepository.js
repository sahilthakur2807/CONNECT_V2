import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class SessionRepository extends BaseRepository {
  constructor() {
    super(prisma.session, "session");
  }

  async findByToken(token, tx) {
    return this.getDelegate(tx).findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async findActiveByUserId(userId, tx) {
    return this.getDelegate(tx).findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * Revokes a single session by setting revoked to true.
   */
  async revokeSession(id, tx) {
    return this.getDelegate(tx).update({
      where: { id },
      data: { revoked: true },
    });
  }

  /**
   * Revokes all active sessions for a user (e.g. log out from all devices, or token replay attack alert).
   */
  async revokeAllForUser(userId, tx) {
    return this.getDelegate(tx).updateMany({
      where: {
        userId,
        revoked: false,
      },
      data: { revoked: true },
    });
  }

  /**
   * Revokes all active sessions for a user except the current active one.
   */
  async revokeOthersForUser(userId, currentToken, tx) {
    return this.getDelegate(tx).updateMany({
      where: {
        userId,
        token: { not: currentToken },
        revoked: false,
      },
      data: { revoked: true },
    });
  }
}
