import { prisma } from '@infrastructure/db/PrismaClient.js';
import { io, pushRealtimeNotification, broadcastStatsUpdate, getRoomActiveCount } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, NotFoundError } from '@shared/errors/AppError.js';
import { EventBus } from '@shared/event-bus/EventBus.js';

// --- Commands ---

export class CreateRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly description: string,
    public readonly category: string,
    public readonly tags: string[] = [],
    public readonly communityId?: string,
    public readonly sourceUrl?: string,
    public readonly imageUrl?: string
  ) {}
}

export class JoinRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string
  ) {}
}

export class LeaveRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string
  ) {}
}

export class CreateRoomMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string,
    public readonly content: string,
    public readonly parentId?: string
  ) {}
}

// --- Handlers ---

export class CreateRoomHandler {
  async execute(command: CreateRoomCommand) {
    const room = await prisma.room.create({
      data: {
        title: command.title,
        description: command.description,
        category: command.category,
        tags: command.tags,
        communityId: command.communityId || null,
        sourceUrl: command.sourceUrl || null,
        imageUrl: command.imageUrl || `https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=200&fit=crop`,
        createdById: command.userId
      }
    });

    broadcastStatsUpdate();

    // Create ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: command.userId,
        action: 'CREATE_ROOM',
        details: `Created room "${room.title}"`
      }
    });

    // Auto join room
    await prisma.roomMember.create({
      data: { userId: command.userId, roomId: room.id }
    });

    const roomWithCounts = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      }
    });

    if (roomWithCounts) {
      const nonDeletedMessages = await prisma.message.count({
        where: { roomId: roomWithCounts.id, deleted: false }
      });
      roomWithCounts._count.messages = nonDeletedMessages;
      (roomWithCounts as any).activeNow = getRoomActiveCount(roomWithCounts.id);
    }

    return roomWithCounts;
  }
}

export class JoinRoomHandler {
  async execute(command: JoinRoomCommand): Promise<void> {
    const existing = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: command.userId, roomId: command.roomId } }
    });

    if (!existing) {
      await prisma.roomMember.create({
        data: { userId: command.userId, roomId: command.roomId }
      });
      // Log activity
      await prisma.activity.create({
        data: { userId: command.userId, roomId: command.roomId, actionType: 'ROOM_JOINED' }
      });
    }

    const memberCount = await prisma.roomMember.count({ where: { roomId: command.roomId } });
    if (io) {
      io.emit('room_stats_update', { roomId: command.roomId, memberCount });
    }
  }
}

export class LeaveRoomHandler {
  async execute(command: LeaveRoomCommand): Promise<void> {
    try {
      await prisma.roomMember.delete({
        where: { userId_roomId: { userId: command.userId, roomId: command.roomId } }
      });
    } catch {
      throw new NotFoundError('Room membership not found');
    }

    const memberCount = await prisma.roomMember.count({ where: { roomId: command.roomId } });
    if (io) {
      io.emit('room_stats_update', { roomId: command.roomId, memberCount });
    }
  }
}

export class CreateRoomMessageHandler {
  async execute(command: CreateRoomMessageCommand) {
    const message = await prisma.message.create({
      data: {
        content: command.content,
        userId: command.userId,
        roomId: command.roomId,
        parentId: command.parentId || null
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
        reactions: true,
        replies: true
      }
    });

    // Update reputation for posting
    await prisma.user.update({
      where: { id: command.userId },
      data: { reputation: { increment: 2 } }
    });

    // Create notification if reply
    if (command.parentId) {
      const parentMessage = await prisma.message.findUnique({ where: { id: command.parentId } });
      const triggerUser = await prisma.user.findUnique({ where: { id: command.userId } });
      if (parentMessage && parentMessage.userId !== command.userId && triggerUser) {
        const notification = await prisma.notification.create({
          data: {
            userId: parentMessage.userId,
            triggerId: command.userId,
            type: 'reply',
            title: 'New Reply',
            body: `${triggerUser.username} replied to your message.`,
            roomId: command.roomId,
            referenceId: message.id
          },
          include: { trigger: true }
        });
        pushRealtimeNotification(parentMessage.userId, notification);
      }
    }

    // Broadcast new message via Socket.IO
    if (io) {
      io.to(`room:${command.roomId}`).emit('new_message', message);
    }

    broadcastStatsUpdate();
    const messageCount = await prisma.message.count({ where: { roomId: command.roomId, deleted: false } });
    if (io) {
      io.emit('room_stats_update', { roomId: command.roomId, messageCount });
    }

    return message;
  }
}
