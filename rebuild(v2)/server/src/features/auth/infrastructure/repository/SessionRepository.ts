import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Session, Prisma } from '@prisma/client';

export class SessionRepository extends BaseRepository<
  Session,
  Prisma.SessionCreateInput,
  Prisma.SessionUpdateInput,
  Prisma.SessionWhereUniqueInput,
  Prisma.SessionWhereInput
> {
  constructor() {
    super(prisma.session, 'session');
  }

  async findByToken(token: string, tx?: any): Promise<Session | null> {
    return this.getDelegate(tx).findUnique({
      where: { token },
      include: { user: true }
    });
  }

  async findActiveByUserId(userId: string, tx?: any): Promise<Session[]> {
    return this.getDelegate(tx).findMany({
      where: {
        userId,
        revoked: false,
        expiresAt: { gt: new Date() }
      }
    });
  }

  /**
   * Revokes a single session by setting revoked to true.
   */
  async revokeSession(id: string, tx?: any): Promise<Session> {
    return this.getDelegate(tx).update({
      where: { id },
      data: { revoked: true }
    });
  }

  /**
   * Revokes all active sessions for a user (e.g. log out from all devices, or token replay attack alert).
   */
  async revokeAllForUser(userId: string, tx?: any): Promise<Prisma.BatchPayload> {
    return this.getDelegate(tx).updateMany({
      where: {
        userId,
        revoked: false
      },
      data: { revoked: true }
    });
  }

  /**
   * Revokes all active sessions for a user except the current active one.
   */
  async revokeOthersForUser(userId: string, currentToken: string, tx?: any): Promise<Prisma.BatchPayload> {
    return this.getDelegate(tx).updateMany({
      where: {
        userId,
        token: { not: currentToken },
        revoked: false
      },
      data: { revoked: true }
    });
  }
}
