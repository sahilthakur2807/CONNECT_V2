import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class ActivityFeedRepository extends BaseRepository {
  constructor() {
    super(prisma.activityFeedItem, "activityFeedItem");
  }

  /**
   * Retrieves paginated activity feed items for a user.
   */
  async findUserFeed(userId, limit = 20, beforeCursor, tx) {
    const delegate = this.getDelegate(tx);
    const where = { userId };

    if (beforeCursor) {
      const cursorItem = await delegate.findUnique({
        where: { id: beforeCursor },
      });
      if (cursorItem) {
        where.createdAt = {
          lt: cursorItem.createdAt,
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        community: { select: { id: true, name: true } },
        room: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Retrieves paginated activity feed items associated with a community.
   */
  async findCommunityFeed(communityId, limit = 20, beforeCursor, tx) {
    const delegate = this.getDelegate(tx);
    const where = { communityId };

    if (beforeCursor) {
      const cursorItem = await delegate.findUnique({
        where: { id: beforeCursor },
      });
      if (cursorItem) {
        where.createdAt = {
          lt: cursorItem.createdAt,
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        room: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
export const activityFeedRepository = new ActivityFeedRepository();
