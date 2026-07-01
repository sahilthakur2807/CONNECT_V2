import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { ActivityFeedItem, Prisma } from '@prisma/client';

export class ActivityFeedRepository extends BaseRepository<
  ActivityFeedItem,
  Prisma.ActivityFeedItemCreateInput,
  Prisma.ActivityFeedItemUpdateInput,
  Prisma.ActivityFeedItemWhereUniqueInput,
  Prisma.ActivityFeedItemWhereInput
> {
  constructor() {
    super(prisma.activityFeedItem, 'activityFeedItem');
  }

  /**
   * Retrieves paginated activity feed items for a user.
   */
  async findUserFeed(userId: string, limit = 20, beforeCursor?: string, tx?: any): Promise<ActivityFeedItem[]> {
    const delegate = this.getDelegate(tx);
    const where: Prisma.ActivityFeedItemWhereInput = { userId };

    if (beforeCursor) {
      const cursorItem = await delegate.findUnique({ where: { id: beforeCursor } });
      if (cursorItem) {
        where.createdAt = {
          lt: cursorItem.createdAt
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        community: { select: { id: true, name: true } },
        room: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Retrieves paginated activity feed items associated with a community.
   */
  async findCommunityFeed(communityId: string, limit = 20, beforeCursor?: string, tx?: any): Promise<ActivityFeedItem[]> {
    const delegate = this.getDelegate(tx);
    const where: Prisma.ActivityFeedItemWhereInput = { communityId };

    if (beforeCursor) {
      const cursorItem = await delegate.findUnique({ where: { id: beforeCursor } });
      if (cursorItem) {
        where.createdAt = {
          lt: cursorItem.createdAt
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        room: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
export const activityFeedRepository = new ActivityFeedRepository();
