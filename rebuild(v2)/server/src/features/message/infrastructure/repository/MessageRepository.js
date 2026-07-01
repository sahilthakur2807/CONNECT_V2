import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class MessageRepository extends BaseRepository {
  constructor() {
    super(prisma.message, "message");
  }

  /**
   * Finds a message by its client-submitted idempotency key.
   */
  async findByClientMessageId(clientMessageId, tx) {
    return this.getDelegate(tx).findUnique({
      where: { clientMessageId },
    });
  }

  /**
   * Retrieves chat history created after a specific message ID cursor (chronological stream loading).
   */
  async findHistoryAfter(roomId, limit = 50, afterCursor, tx) {
    const delegate = this.getDelegate(tx);
    const where = {
      roomId,
      deleted: false,
    };

    if (afterCursor) {
      const cursorMessage = await delegate.findUnique({
        where: { id: afterCursor },
      });
      if (cursorMessage) {
        where.createdAt = {
          gt: cursorMessage.createdAt,
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
    });
  }

  /**
   * Retrieves chat history created before a specific message ID cursor (scrolling up to load past messages).
   * Returns them in ascending chronological order.
   */
  async findHistoryBefore(roomId, limit = 50, beforeCursor, tx) {
    const delegate = this.getDelegate(tx);
    const where = {
      roomId,
      deleted: false,
    };

    if (beforeCursor) {
      const cursorMessage = await delegate.findUnique({
        where: { id: beforeCursor },
      });
      if (cursorMessage) {
        where.createdAt = {
          lt: cursorMessage.createdAt,
        };
      }
    }

    const messages = await delegate.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Reverse to return chronological asc
    return messages.reverse();
  }

  /**
   * Retrieves all nested replies for a given message.
   */
  async findReplies(messageId, tx) {
    return this.getDelegate(tx).findMany({
      where: {
        parentId: messageId,
        deleted: false,
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }
}
export const messageRepository = new MessageRepository();
