import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { ModerationAction, Prisma } from '@prisma/client';

export class ModerationActionRepository extends BaseRepository<
  ModerationAction,
  Prisma.ModerationActionCreateInput,
  Prisma.ModerationActionUpdateInput,
  Prisma.ModerationActionWhereUniqueInput,
  Prisma.ModerationActionWhereInput
> {
  constructor() {
    super(prisma.moderationAction, 'moderationAction');
  }

  /**
   * Retrieves active, non-expired enforcements for a specific user.
   */
  async findActiveActions(userId: string, tx?: any): Promise<ModerationAction[]> {
    const delegate = this.getDelegate(tx);
    return delegate.findMany({
      where: {
        userId,
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });
  }

  /**
   * Evaluates if a user is currently muted inside a specific community.
   */
  async findActiveMute(userId: string, communityId: string, tx?: any): Promise<ModerationAction | null> {
    const delegate = this.getDelegate(tx);
    return delegate.findFirst({
      where: {
        userId,
        communityId,
        type: 'mute',
        active: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });
  }
}
export const moderationActionRepository = new ModerationActionRepository();
