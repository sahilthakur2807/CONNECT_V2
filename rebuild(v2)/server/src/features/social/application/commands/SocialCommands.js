import { SocialPolicy } from "../SocialPolicy.js";
import { NotificationPolicy } from "../NotificationPolicy.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Commands ---

export class SendFriendRequestCommand {
  constructor(userId, targetUserId) {
    this.userId = userId;
    this.targetUserId = targetUserId;
  }
}

export class AcceptFriendRequestCommand {
  constructor(userId, requestId) {
    this.userId = userId;
    this.requestId = requestId;
  }
}

export class RejectFriendRequestCommand {
  constructor(userId, requestId) {
    this.userId = userId;
    this.requestId = requestId;
  }
}

export class CancelFriendRequestCommand {
  constructor(userId, requestId) {
    this.userId = userId;
    this.requestId = requestId;
  }
}

export class RemoveFriendCommand {
  constructor(userId, friendId) {
    this.userId = userId;
    this.friendId = friendId;
  }
}

export class BlockUserCommand {
  constructor(userId, targetUserId) {
    this.userId = userId;
    this.targetUserId = targetUserId;
  }
}

export class UnblockUserCommand {
  constructor(userId, targetUserId) {
    this.userId = userId;
    this.targetUserId = targetUserId;
  }
}

export class MarkNotificationReadCommand {
  constructor(userId, notificationId) {
    this.userId = userId;
    this.notificationId = notificationId;
  }
}

export class MarkAllNotificationsReadCommand {
  constructor(userId) {
    this.userId = userId;
  }
}

// --- Domain Events ---

export class FriendRequestSentEvent {
  eventName = "friend.request.sent";
  occurredAt = new Date();
  constructor(friendshipId, senderId, recipientId) {
    this.friendshipId = friendshipId;
    this.senderId = senderId;
    this.recipientId = recipientId;
  }
}

export class FriendRequestAcceptedEvent {
  eventName = "friend.request.accepted";
  occurredAt = new Date();
  constructor(friendshipId, userId, friendId) {
    this.friendshipId = friendshipId;
    this.userId = userId;
    this.friendId = friendId;
  }
}

export class FriendRemovedEvent {
  eventName = "friend.removed";
  occurredAt = new Date();
  constructor(userId, friendId) {
    this.userId = userId;
    this.friendId = friendId;
  }
}

export class UserBlockedEvent {
  eventName = "user.blocked";
  occurredAt = new Date();
  constructor(blockerId, blockedId) {
    this.blockerId = blockerId;
    this.blockedId = blockedId;
  }
}

export class UserUnblockedEvent {
  eventName = "user.unblocked";
  occurredAt = new Date();
  constructor(blockerId, unblockedId) {
    this.blockerId = blockerId;
    this.unblockedId = unblockedId;
  }
}

export class NotificationCreatedEvent {
  eventName = "notification.created";
  occurredAt = new Date();
  constructor(notificationId, recipientId) {
    this.notificationId = notificationId;
    this.recipientId = recipientId;
  }
}

export class NotificationReadEvent {
  eventName = "notification.read";
  occurredAt = new Date();
  constructor(notificationId, recipientId) {
    this.notificationId = notificationId;
    this.recipientId = recipientId;
  }
}

// --- Handlers ---

export class SendFriendRequestHandler {
  constructor(friendshipRepo, blockRepo, notificationRepo) {
    this.friendshipRepo = friendshipRepo;
    this.blockRepo = blockRepo;
    this.notificationRepo = notificationRepo;
  }

  async execute(command) {
    const isBlocked = await this.blockRepo.hasBlockRelationship(
      command.userId,
      command.targetUserId,
    );
    if (
      !SocialPolicy.canRequestFriendship(
        command.userId,
        command.targetUserId,
        isBlocked,
      )
    ) {
      throw new ForbiddenError("Interaction blocked or invalid");
    }

    const existing = await this.friendshipRepo.findFriendship(
      command.userId,
      command.targetUserId,
    );
    if (existing) {
      throw new BadRequestError(
        "Friendship relationship or pending request already exists",
      );
    }

    return prisma.$transaction(async (tx) => {
      const friendship = await this.friendshipRepo.create(
        {
          status: "pending",
          user: { connect: { id: command.userId } },
          friend: { connect: { id: command.targetUserId } },
        },
        tx,
      );

      // Create notification
      const notification = await this.notificationRepo.create(
        {
          type: "friend.request.sent",
          title: "New Friend Request",
          body: `You received a friend request from User A`, // trigger will be linked below
          referenceId: friendship.id,
          user: { connect: { id: command.targetUserId } },
          trigger: { connect: { id: command.userId } },
        },
        tx,
      );

      await EventBus.publish(
        new FriendRequestSentEvent(
          friendship.id,
          command.userId,
          command.targetUserId,
        ),
      );
      await EventBus.publish(
        new NotificationCreatedEvent(notification.id, command.targetUserId),
      );

      // Realtime alert emission directly to B's user channel
      if (io) {
        io.to(command.targetUserId).emit("notification.created", {
          ...notification,
          success: true,
          data: notification,
        });
        io.to(command.targetUserId).emit("friend.request.sent", {
          success: true,
          data: friendship,
        });
      }

      return friendship;
    });
  }
}

export class AcceptFriendRequestHandler {
  constructor(friendshipRepo, notificationRepo) {
    this.friendshipRepo = friendshipRepo;
    this.notificationRepo = notificationRepo;
  }

  async execute(command) {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError("Friend request not found");

    if (friendship.friendId !== command.userId) {
      throw new ForbiddenError(
        "Only the recipient can accept a friend request",
      );
    }

    if (friendship.status !== "pending") {
      throw new BadRequestError("Friend request is not pending");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await this.friendshipRepo.update(
        command.requestId,
        { status: "accepted" },
        tx,
      );

      await tx.notification.updateMany({
        where: {
          type: "friend.request.sent",
          referenceId: command.requestId,
        },
        data: {
          status: "accepted",
        },
      });

      const notification = await this.notificationRepo.create(
        {
          type: "friend.request.accepted",
          title: "Friend Request Accepted",
          body: `Your friend request was accepted`,
          referenceId: friendship.id,
          user: { connect: { id: friendship.userId } },
          trigger: { connect: { id: command.userId } },
        },
        tx,
      );

      await EventBus.publish(
        new FriendRequestAcceptedEvent(
          friendship.id,
          friendship.userId,
          friendship.friendId,
        ),
      );
      await EventBus.publish(
        new NotificationCreatedEvent(notification.id, friendship.userId),
      );

      if (io) {
        io.to(friendship.userId).emit("notification.created", {
          ...notification,
          success: true,
          data: notification,
        });
        io.to(friendship.userId).emit("friend.request.accepted", {
          success: true,
          data: updated,
        });
      }

      return updated;
    });
  }
}

export class RejectFriendRequestHandler {
  constructor(friendshipRepo) {
    this.friendshipRepo = friendshipRepo;
  }

  async execute(command) {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError("Friend request not found");

    if (friendship.friendId !== command.userId) {
      throw new ForbiddenError("Only the recipient can reject a request");
    }

    await prisma.$transaction(async (tx) => {
      await this.friendshipRepo.delete(command.requestId, tx);

      await tx.notification.updateMany({
        where: {
          type: "friend.request.sent",
          referenceId: command.requestId,
        },
        data: {
          status: "declined",
        },
      });
    });
  }
}

export class CancelFriendRequestCommand_Handler {
  constructor(friendshipRepo) {
    this.friendshipRepo = friendshipRepo;
  }

  async execute(command) {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError("Friend request not found");

    if (friendship.userId !== command.userId) {
      throw new ForbiddenError("Only the sender can cancel a pending request");
    }

    await this.friendshipRepo.delete(command.requestId);
  }
}

export class RemoveFriendHandler {
  constructor(friendshipRepo) {
    this.friendshipRepo = friendshipRepo;
  }

  async execute(command) {
    const friendship = await this.friendshipRepo.findFriendship(
      command.userId,
      command.friendId,
    );
    if (!friendship || friendship.status !== "accepted") {
      throw new NotFoundError("Friend relationship not found");
    }

    await this.friendshipRepo.delete(friendship.id);
    await EventBus.publish(
      new FriendRemovedEvent(command.userId, command.friendId),
    );
  }
}

export class BlockUserHandler {
  constructor(blockRepo, friendshipRepo) {
    this.blockRepo = blockRepo;
    this.friendshipRepo = friendshipRepo;
  }

  async execute(command) {
    if (command.userId === command.targetUserId) {
      throw new BadRequestError("You cannot block yourself");
    }

    const existingBlock = await this.blockRepo.findBlock(
      command.userId,
      command.targetUserId,
    );

    if (existingBlock) return existingBlock;

    return prisma.$transaction(async (tx) => {
      const block = await this.blockRepo.create(
        {
          user: { connect: { id: command.userId } },
          blocked: { connect: { id: command.targetUserId } },
        },
        tx,
      );

      // Dissolve any existing friendships or pending requests between them
      const friendship = await this.friendshipRepo.findFriendship(
        command.userId,
        command.targetUserId,
        tx,
      );
      if (friendship) {
        await this.friendshipRepo.delete(friendship.id, tx);
      }

      await EventBus.publish(
        new UserBlockedEvent(command.userId, command.targetUserId),
      );
      return block;
    });
  }
}

export class UnblockUserHandler {
  constructor(blockRepo) {
    this.blockRepo = blockRepo;
  }

  async execute(command) {
    const block = await this.blockRepo.findBlock(
      command.userId,
      command.targetUserId,
    );

    if (!block) throw new NotFoundError("Block relationship not found");

    await this.blockRepo.delete(block.id);
    await EventBus.publish(
      new UserUnblockedEvent(command.userId, command.targetUserId),
    );
  }
}

export class MarkNotificationReadHandler {
  constructor(notificationRepo) {
    this.notificationRepo = notificationRepo;
  }

  async execute(command) {
    const notification = await this.notificationRepo.findById(
      command.notificationId,
    );
    if (!notification) throw new NotFoundError("Notification not found");

    if (
      !NotificationPolicy.canMutateNotification(
        command.userId,
        notification.userId,
      )
    ) {
      throw new ForbiddenError(
        "You do not have permission to modify this notification",
      );
    }

    const updated = await this.notificationRepo.update(command.notificationId, {
      read: true,
    });
    await EventBus.publish(
      new NotificationReadEvent(command.notificationId, notification.userId),
    );
    return updated;
  }
}

export class MarkAllNotificationsReadHandler {
  constructor(notificationRepo) {
    this.notificationRepo = notificationRepo;
  }

  async execute(command) {
    await this.notificationRepo.markAllAsRead(command.userId);
  }
}
