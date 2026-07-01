import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Notification, Prisma } from '@prisma/client';

export class NotificationRepository extends BaseRepository<
  Notification,
  Prisma.NotificationCreateInput,
  Prisma.NotificationUpdateInput,
  Prisma.NotificationWhereUniqueInput,
  Prisma.NotificationWhereInput
> {
  constructor() {
    super(prisma.notification, 'notification');
  }

  /**
   * Marks all unread notifications for a user as read.
   */
  async markAllAsRead(userId: string, tx?: any): Promise<void> {
    await this.getDelegate(tx).updateMany({
      where: {
        userId,
        read: false
      },
      data: {
        read: true
      }
    });
  }

  /**
   * Retrieves notification feed with backward cursor-based pagination.
   */
  async findHistory(userId: string, limit = 20, beforeCursor?: string, tx?: any): Promise<Notification[]> {
    const delegate = this.getDelegate(tx);
    const where: Prisma.NotificationWhereInput = { userId };

    if (beforeCursor) {
      const cursorNotification = await delegate.findUnique({
        where: { id: beforeCursor }
      });
      if (cursorNotification) {
        where.createdAt = {
          lt: cursorNotification.createdAt
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        trigger: {
          select: { id: true, username: true, name: true, avatar: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });
  }

  /**
   * Counts unread notifications.
   */
  async findUnreadCount(userId: string, tx?: any): Promise<number> {
    return this.getDelegate(tx).count({
      where: {
        userId,
        read: false
      }
    });
  }
}
export const notificationRepository = new NotificationRepository();
