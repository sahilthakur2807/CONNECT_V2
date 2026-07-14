import { MessagePolicy } from "../MessagePolicy.js";
import { extractHashtags } from "../../../../shared/utils/Sanitizer.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Commands ---

export class SendMessageCommand {
  constructor(userId, roomId, content, clientMessageId, parentId, userRole) {
    this.userId = userId;
    this.roomId = roomId;
    this.content = content;
    this.clientMessageId = clientMessageId;
    this.parentId = parentId;
    this.userRole = userRole;
  }
}

export class EditMessageCommand {
  constructor(userId, messageId, content) {
    this.userId = userId;
    this.messageId = messageId;
    this.content = content;
  }
}

export class DeleteMessageCommand {
  constructor(userId, messageId, userRole) {
    this.userId = userId;
    this.messageId = messageId;
    this.userRole = userRole;
  }
}

export class RestoreMessageCommand {
  constructor(userId, messageId, userRole) {
    this.userId = userId;
    this.messageId = messageId;
    this.userRole = userRole;
  }
}

// --- Domain Events ---

export class MessageCreatedEvent {
  eventName = "message.created";
  occurredAt = new Date();
  constructor(messageId, roomId) {
    this.messageId = messageId;
    this.roomId = roomId;
  }
}

export class MessageUpdatedEvent {
  eventName = "message.updated";
  occurredAt = new Date();
  constructor(messageId, roomId) {
    this.messageId = messageId;
    this.roomId = roomId;
  }
}

export class MessageDeletedEvent {
  eventName = "message.deleted";
  occurredAt = new Date();
  constructor(messageId, roomId) {
    this.messageId = messageId;
    this.roomId = roomId;
  }
}

export class MessageRestoredEvent {
  eventName = "message.restored";
  occurredAt = new Date();
  constructor(messageId, roomId) {
    this.messageId = messageId;
    this.roomId = roomId;
  }
}

// --- Handlers ---

export class SendMessageHandler {
  constructor(messageRepo, roomRepo, communityRepo, membershipRepo) {
    this.messageRepo = messageRepo;
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError("Room not found");
    if (room.archived)
      throw new BadRequestError("Room is archived and read-only");

    if (room.isPrivate) {
      const userRole = command.userRole?.toUpperCase();
      const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(userRole);
      const isRoomCreator = room.createdById === command.userId;

      const roomMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: command.userId,
            roomId: room.id
          }
        }
      });
      const isRoomMod = roomMember && roomMember.status === "ROOM_MOD";

      if (!isPlatformStaff && !isRoomCreator && !isRoomMod) {
        throw new ForbiddenError("This room is private and you do not have permission to send messages in it");
      }
    }

    // 1. Idempotency Check
    if (command.clientMessageId) {
      const existing = await this.messageRepo.findByClientMessageId(
        command.clientMessageId,
      );
      if (existing) {
        return existing; // Return duplicate message without insertion
      }
    }

    // 2. Fetch membership context
    let membership = null;
    if (room.communityId) {
      membership = await this.membershipRepo.findMember(
        command.userId,
        room.communityId,
      );
    }

    // Check for platform-wide ban/suspension
    const activePlatformBan = await prisma.moderationAction.findFirst({
      where: {
        userId: command.userId,
        communityId: null,
        type: { in: ["ban", "suspend"] },
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    // Check for platform-wide mute
    const activePlatformMute = await prisma.moderationAction.findFirst({
      where: {
        userId: command.userId,
        communityId: null,
        type: "mute",
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    // Check room-specific mutes/bans
    let isRoomMuted = false;
    if (command.roomId) {
      const roomMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: command.userId,
            roomId: command.roomId,
          },
        },
      });
      if (
        roomMember &&
        ["muted", "kicked", "banned"].includes(roomMember.status)
      ) {
        isRoomMuted = true;
      }
    }

    // Check for room-specific moderation restriction
    const activeRoomRestriction = await prisma.moderationAction.findFirst({
      where: {
        userId: command.userId,
        roomId: command.roomId,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (activeRoomRestriction) {
      throw new ForbiddenError("Your account has been restricted from sending messages to this room");
    }

    // 3. Policy Authorization
    const allowed = MessagePolicy.canSend(
      { id: command.userId, role: command.userRole },
      membership || undefined,
      !!activePlatformBan,
      !!activePlatformMute,
      isRoomMuted,
    );
    if (!allowed)
      throw new ForbiddenError("You are banned or muted in this room/community");

    // 4. Persistence
    const message = await this.messageRepo.create({
      content: command.content,
      clientMessageId: command.clientMessageId,
      user: { connect: { id: command.userId } },
      room: { connect: { id: command.roomId } },
      ...(command.parentId
        ? { parent: { connect: { id: command.parentId } } }
        : {}),
    });

    // Extract and associate hashtags with the room
    const hashtagNames = extractHashtags(command.content);
    if (hashtagNames.length > 0) {
      await this.roomRepo.associateHashtags(command.roomId, hashtagNames);
    }

    // 5. Query full message details (including user details) for broadcast
    const fullMessage = await this.messageRepo.findById(message.id);

    // 6. Domain Event
    await EventBus.publish(new MessageCreatedEvent(message.id, command.roomId));

    // 7. Realtime Broadcast
    if (io) {
      io.to(command.roomId).emit("chat.message.created", {
        success: true,
        data: fullMessage,
      });
    }

    return fullMessage;
  }
}

export class EditMessageHandler {
  constructor(messageRepo) {
    this.messageRepo = messageRepo;
  }

  async execute(command) {
    const message = await this.messageRepo.findById(command.messageId);
    if (!message || message.deleted)
      throw new NotFoundError("Message not found");

    const allowed = MessagePolicy.canEdit(
      { id: command.userId, role: "" },
      message.userId,
    );
    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to edit this message",
      );

    const updated = await this.messageRepo.update(command.messageId, {
      content: command.content,
      edited: true,
    });

    await EventBus.publish(new MessageUpdatedEvent(message.id, message.roomId));

    if (io) {
      io.to(message.roomId).emit("chat.message.updated", {
        success: true,
        data: updated,
      });
    }

    return updated;
  }
}

export class DeleteMessageHandler {
  constructor(messageRepo) {
    this.messageRepo = messageRepo;
  }

  async execute(command) {
    const message = await this.messageRepo.findById(command.messageId);
    if (!message || message.deleted)
      throw new NotFoundError("Message not found");

    const room = await prisma.room.findUnique({
      where: { id: message.roomId },
      select: { communityId: true },
    });
    const communityId = room?.communityId;

    let actorCommunityRole = null;
    if (communityId) {
      const membership = await prisma.communityMember.findFirst({
        where: {
          userId: command.userId,
          communityId: communityId,
        },
      });
      if (membership && !membership.banned) {
        actorCommunityRole = membership.role;
      }
    }

    let actorRoomStatus = null;
    if (message.roomId) {
      const roomMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: command.userId,
            roomId: message.roomId,
          },
        },
      });
      if (roomMember) {
        actorRoomStatus = roomMember.status;
      }
    }

    const allowed = MessagePolicy.canDelete(
      { id: command.userId, role: command.userRole },
      message.userId,
      actorCommunityRole,
      actorRoomStatus,
    );
    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to delete this message",
      );

    await this.messageRepo.update(command.messageId, { deleted: true });

    await EventBus.publish(new MessageDeletedEvent(message.id, message.roomId));

    if (io) {
      io.to(message.roomId).emit("chat.message.deleted", {
        success: true,
        data: { id: message.id },
      });
    }
  }
}

export class RestoreMessageHandler {
  constructor(messageRepo) {
    this.messageRepo = messageRepo;
  }

  async execute(command) {
    // Explicitly search raw database context or override soft delete filter
    const message = await this.messageRepo.findById(command.messageId);
    if (!message) throw new NotFoundError("Message not found");

    const room = await prisma.room.findUnique({
      where: { id: message.roomId },
      select: { communityId: true },
    });
    const communityId = room?.communityId;

    let actorCommunityRole = null;
    if (communityId) {
      const membership = await prisma.communityMember.findFirst({
        where: {
          userId: command.userId,
          communityId: communityId,
        },
      });
      if (membership && !membership.banned) {
        actorCommunityRole = membership.role;
      }
    }

    let actorRoomStatus = null;
    if (message.roomId) {
      const roomMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: command.userId,
            roomId: message.roomId,
          },
        },
      });
      if (roomMember) {
        actorRoomStatus = roomMember.status;
      }
    }

    const allowed = MessagePolicy.canDelete(
      { id: command.userId, role: command.userRole },
      message.userId,
      actorCommunityRole,
      actorRoomStatus,
    );
    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to restore this message",
      );

    const updated = await this.messageRepo.update(command.messageId, {
      deleted: false,
    });

    await EventBus.publish(
      new MessageRestoredEvent(message.id, message.roomId),
    );

    if (io) {
      io.to(message.roomId).emit("chat.message.restored", {
        success: true,
        data: updated,
      });
    }

    return updated;
  }
}
