import { prisma } from '@infrastructure/db/PrismaClient.js';
import { io, pushRealtimeNotification, broadcastStatsUpdate } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@shared/errors/AppError.js';

// --- Commands ---

export class EditMessageCommand {
  constructor(
    public readonly messageId: string,
    public readonly content: string,
    public readonly userId: string,
    public readonly userRole: string
  ) {}
}

export class DeleteMessageCommand {
  constructor(
    public readonly messageId: string,
    public readonly userId: string,
    public readonly userRole: string
  ) {}
}

export class CreateReplyCommand {
  constructor(
    public readonly messageId: string,
    public readonly content: string,
    public readonly userId: string
  ) {}
}

export class ToggleReactionCommand {
  constructor(
    public readonly messageId: string,
    public readonly emoji: string,
    public readonly userId: string
  ) {}
}

// --- Handlers ---

export class EditMessageHandler {
  async execute(command: EditMessageCommand) {
    const message = await prisma.message.findUnique({ where: { id: command.messageId } });
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const isAdminOrSuperAdmin = command.userRole === 'admin' || command.userRole === 'superadmin';
    if (message.userId !== command.userId && !isAdminOrSuperAdmin) {
      throw new UnauthorizedError('Unauthorized to edit this message');
    }

    const updated = await prisma.message.update({
      where: { id: command.messageId },
      data: { content: command.content, edited: true },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            verified: true,
            role: true,
            reputation: true,
            badges: true
          }
        },
        reactions: true,
        replies: true
      }
    });

    if (io) {
      io.to(`room:${updated.roomId}`).emit('update_message', updated);
    }

    return updated;
  }
}

export class DeleteMessageHandler {
  async execute(command: DeleteMessageCommand): Promise<void> {
    const message = await prisma.message.findUnique({ where: { id: command.messageId } });
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const room = await prisma.room.findUnique({ where: { id: message.roomId } });
    const isRoomCreator = room?.createdById === command.userId;
    const isCommonModerator = command.userRole === 'moderator';
    const isAdminOrSuperAdmin = command.userRole === 'admin' || command.userRole === 'superadmin';

    if (message.userId !== command.userId && !isAdminOrSuperAdmin && !isCommonModerator && !isRoomCreator) {
      throw new UnauthorizedError('Unauthorized to delete this message');
    }

    await prisma.message.update({
      where: { id: command.messageId },
      data: { deleted: true }
    });

    if (io) {
      io.to(`room:${message.roomId}`).emit('delete_message', command.messageId);
    }

    broadcastStatsUpdate();
    const messageCount = await prisma.message.count({ where: { roomId: message.roomId, deleted: false } });
    if (io) {
      io.emit('room_stats_update', { roomId: message.roomId, messageCount });
    }
  }
}

export class CreateReplyHandler {
  async execute(command: CreateReplyCommand) {
    const parentMessage = await prisma.message.findUnique({ where: { id: command.messageId } });
    if (!parentMessage) {
      throw new NotFoundError('Parent message not found');
    }

    const message = await prisma.message.create({
      data: {
        content: command.content,
        userId: command.userId,
        roomId: parentMessage.roomId,
        parentId: command.messageId
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            verified: true,
            role: true,
            reputation: true,
            badges: true
          }
        },
        reactions: true
      }
    });

    await prisma.user.update({
      where: { id: command.userId },
      data: { reputation: { increment: 2 } }
    });

    if (parentMessage.userId !== command.userId) {
      const triggerUser = await prisma.user.findUnique({ where: { id: command.userId } });
      if (triggerUser) {
        const notification = await prisma.notification.create({
          data: {
            userId: parentMessage.userId,
            triggerId: command.userId,
            type: 'reply',
            title: 'New Reply',
            body: `${triggerUser.username} replied to your message.`,
            roomId: parentMessage.roomId,
            referenceId: message.id
          },
          include: { trigger: true }
        });
        pushRealtimeNotification(parentMessage.userId, notification);
      }
    }

    if (io) {
      io.to(`room:${parentMessage.roomId}`).emit('new_message', message);
    }

    broadcastStatsUpdate();
    const messageCount = await prisma.message.count({ where: { roomId: parentMessage.roomId, deleted: false } });
    if (io) {
      io.emit('room_stats_update', { roomId: parentMessage.roomId, messageCount });
    }

    return message;
  }
}

export class ToggleReactionHandler {
  async execute(command: ToggleReactionCommand): Promise<void> {
    const message = await prisma.message.findUnique({ where: { id: command.messageId } });
    if (!message) {
      throw new NotFoundError('Message not found');
    }

    const existing = await prisma.reaction.findUnique({
      where: {
        userId_messageId_emoji: {
          userId: command.userId,
          messageId: command.messageId,
          emoji: command.emoji
        }
      }
    });

    if (existing) {
      await prisma.reaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.reaction.create({
        data: {
          emoji: command.emoji,
          userId: command.userId,
          messageId: command.messageId
        }
      });

      if (message.userId !== command.userId) {
        const triggerUser = await prisma.user.findUnique({ where: { id: command.userId } });
        if (triggerUser) {
          const notification = await prisma.notification.create({
            data: {
              userId: message.userId,
              triggerId: command.userId,
              type: 'reaction',
              title: 'Message Reacted',
              body: `${triggerUser.username} reacted ${command.emoji} to your message.`,
              roomId: message.roomId,
              referenceId: message.id
            },
            include: { trigger: true }
          });
          pushRealtimeNotification(message.userId, notification);
        }
      }
    }

    // Refetch full message to emit update
    const updatedMessage = await prisma.message.findUnique({
      where: { id: command.messageId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            verified: true,
            role: true,
            reputation: true,
            badges: true
          }
        },
        reactions: {
          include: {
            user: { select: { id: true, username: true } }
          }
        },
        replies: {
          where: { deleted: false },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                verified: true,
                role: true,
                reputation: true,
                badges: true
              }
            },
            reactions: {
              include: {
                user: { select: { id: true, username: true } }
              }
            }
          }
        }
      }
    });

    if (updatedMessage && io) {
      io.to(`room:${updatedMessage.roomId}`).emit('update_message', updatedMessage);
    }
  }
}
