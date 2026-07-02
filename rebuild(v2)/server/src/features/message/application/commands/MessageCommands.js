import { MessagePolicy } from "../MessagePolicy.js";
import { extractHashtags } from "../../../../shared/utils/Sanitizer.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";

// --- Commands ---

export class SendMessageCommand {
  constructor(userId, roomId, content, clientMessageId, parentId) {
    this.userId = userId;
    this.roomId = roomId;
    this.content = content;
    this.clientMessageId = clientMessageId;
    this.parentId = parentId;
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
  constructor(userId, messageId) {
    this.userId = userId;
    this.messageId = messageId;
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

    // 3. Policy Authorization
    const allowed = MessagePolicy.canSend(
      { id: command.userId, role: "" },
      membership || undefined,
    );
    if (!allowed)
      throw new ForbiddenError("You are banned or muted in this community");

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

    const allowed = MessagePolicy.canMutate(
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

    const allowed = MessagePolicy.canMutate(
      { id: command.userId, role: command.userRole },
      message.userId,
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

    const allowed = MessagePolicy.canMutate(
      { id: command.userId, role: "" },
      message.userId,
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
