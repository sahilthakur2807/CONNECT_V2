import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class NotificationRepository extends BaseRepository {
  constructor() {
    super(prisma.notification, "notification");
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId, tx) {
    await this.getDelegate(tx).updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }

  /**
   * Retrieves notification feed with backward cursor-based pagination.
   */
  async findHistory(userId, limit = 20, beforeCursor, tx) {
    const delegate = this.getDelegate(tx);
    const where = { userId };

    if (beforeCursor) {
      const cursorNotification = await delegate.findUnique({
        where: { id: beforeCursor },
      });
      if (cursorNotification) {
        where.createdAt = {
          lt: cursorNotification.createdAt,
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        trigger: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });
  }

  /**
   * Counts unread notifications.
   */
  async findUnreadCount(userId, tx) {
    return this.getDelegate(tx).count({
      where: {
        userId,
        read: false,
      },
    });
  }
}
export const notificationRepository = new NotificationRepository();
