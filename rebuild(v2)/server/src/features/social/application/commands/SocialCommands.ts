import { FriendshipRepository } from '../../infrastructure/repository/FriendshipRepository.js';
import { BlockRepository } from '../../infrastructure/repository/BlockRepository.js';
import { NotificationRepository } from '../../infrastructure/repository/NotificationRepository.js';
import { SocialPolicy } from '../SocialPolicy.js';
import { NotificationPolicy } from '../NotificationPolicy.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';
import { io } from '../../../../infrastructure/socket/SocketServer.js';
import { prisma } from '../../../../infrastructure/db/PrismaClient.js';

// --- Commands ---

export class SendFriendRequestCommand {
  constructor(public readonly userId: string, public readonly targetUserId: string) {}
}

export class AcceptFriendRequestCommand {
  constructor(public readonly userId: string, public readonly requestId: string) {}
}

export class RejectFriendRequestCommand {
  constructor(public readonly userId: string, public readonly requestId: string) {}
}

export class CancelFriendRequestCommand {
  constructor(public readonly userId: string, public readonly requestId: string) {}
}

export class RemoveFriendCommand {
  constructor(public readonly userId: string, public readonly friendId: string) {}
}

export class BlockUserCommand {
  constructor(public readonly userId: string, public readonly targetUserId: string) {}
}

export class UnblockUserCommand {
  constructor(public readonly userId: string, public readonly targetUserId: string) {}
}

export class MarkNotificationReadCommand {
  constructor(public readonly userId: string, public readonly notificationId: string) {}
}

export class MarkAllNotificationsReadCommand {
  constructor(public readonly userId: string) {}
}

// --- Domain Events ---

export class FriendRequestSentEvent implements IDomainEvent {
  readonly eventName = 'friend.request.sent';
  readonly occurredAt = new Date();
  constructor(public readonly friendshipId: string, public readonly senderId: string, public readonly recipientId: string) {}
}

export class FriendRequestAcceptedEvent implements IDomainEvent {
  readonly eventName = 'friend.request.accepted';
  readonly occurredAt = new Date();
  constructor(public readonly friendshipId: string, public readonly userId: string, public readonly friendId: string) {}
}

export class FriendRemovedEvent implements IDomainEvent {
  readonly eventName = 'friend.removed';
  readonly occurredAt = new Date();
  constructor(public readonly userId: string, public readonly friendId: string) {}
}

export class UserBlockedEvent implements IDomainEvent {
  readonly eventName = 'user.blocked';
  readonly occurredAt = new Date();
  constructor(public readonly blockerId: string, public readonly blockedId: string) {}
}

export class UserUnblockedEvent implements IDomainEvent {
  readonly eventName = 'user.unblocked';
  readonly occurredAt = new Date();
  constructor(public readonly blockerId: string, public readonly unblockedId: string) {}
}

export class NotificationCreatedEvent implements IDomainEvent {
  readonly eventName = 'notification.created';
  readonly occurredAt = new Date();
  constructor(public readonly notificationId: string, public readonly recipientId: string) {}
}

export class NotificationReadEvent implements IDomainEvent {
  readonly eventName = 'notification.read';
  readonly occurredAt = new Date();
  constructor(public readonly notificationId: string, public readonly recipientId: string) {}
}

// --- Handlers ---

export class SendFriendRequestHandler {
  constructor(
    private readonly friendshipRepo: FriendshipRepository,
    private readonly blockRepo: BlockRepository,
    private readonly notificationRepo: NotificationRepository
  ) {}

  async execute(command: SendFriendRequestCommand): Promise<any> {
    const isBlocked = await this.blockRepo.hasBlockRelationship(command.userId, command.targetUserId);
    if (!SocialPolicy.canRequestFriendship(command.userId, command.targetUserId, isBlocked)) {
      throw new ForbiddenError('Interaction blocked or invalid');
    }

    const existing = await this.friendshipRepo.findFriendship(command.userId, command.targetUserId);
    if (existing) {
      throw new BadRequestError('Friendship relationship or pending request already exists');
    }

    return prisma.$transaction(async (tx) => {
      const friendship = await this.friendshipRepo.create({
        status: 'pending',
        user: { connect: { id: command.userId } },
        friend: { connect: { id: command.targetUserId } }
      }, tx);

      // Create notification
      const notification = await this.notificationRepo.create({
        type: 'friend.request.sent',
        title: 'New Friend Request',
        body: `You received a friend request from User A`, // trigger will be linked below
        referenceId: friendship.id,
        user: { connect: { id: command.targetUserId } },
        trigger: { connect: { id: command.userId } }
      }, tx);

      await EventBus.publish(new FriendRequestSentEvent(friendship.id, command.userId, command.targetUserId));
      await EventBus.publish(new NotificationCreatedEvent(notification.id, command.targetUserId));

      // Realtime alert emission directly to B's user channel
      if (io) {
        io.to(command.targetUserId).emit('notification.created', {
          success: true,
          data: notification
        });
        io.to(command.targetUserId).emit('friend.request.sent', {
          success: true,
          data: friendship
        });
      }

      return friendship;
    });
  }
}

export class AcceptFriendRequestHandler {
  constructor(
    private readonly friendshipRepo: FriendshipRepository,
    private readonly notificationRepo: NotificationRepository
  ) {}

  async execute(command: AcceptFriendRequestCommand): Promise<any> {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError('Friend request not found');

    if (friendship.friendId !== command.userId) {
      throw new ForbiddenError('Only the recipient can accept a friend request');
    }

    if (friendship.status !== 'pending') {
      throw new BadRequestError('Friend request is not pending');
    }

    return prisma.$transaction(async (tx) => {
      const updated = await this.friendshipRepo.update(command.requestId, { status: 'accepted' }, tx);

      await tx.notification.updateMany({
        where: {
          type: 'friend.request.sent',
          referenceId: command.requestId
        },
        data: {
          status: 'accepted'
        }
      });

      const notification = await this.notificationRepo.create({
        type: 'friend.request.accepted',
        title: 'Friend Request Accepted',
        body: `Your friend request was accepted`,
        referenceId: friendship.id,
        user: { connect: { id: friendship.userId } },
        trigger: { connect: { id: command.userId } }
      }, tx);

      await EventBus.publish(new FriendRequestAcceptedEvent(friendship.id, friendship.userId, friendship.friendId));
      await EventBus.publish(new NotificationCreatedEvent(notification.id, friendship.userId));

      if (io) {
        io.to(friendship.userId).emit('notification.created', {
          success: true,
          data: notification
        });
        io.to(friendship.userId).emit('friend.request.accepted', {
          success: true,
          data: updated
        });
      }

      return updated;
    });
  }
}

export class RejectFriendRequestHandler {
  constructor(private readonly friendshipRepo: FriendshipRepository) {}

  async execute(command: RejectFriendRequestCommand): Promise<void> {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError('Friend request not found');

    if (friendship.friendId !== command.userId) {
      throw new ForbiddenError('Only the recipient can reject a request');
    }

    await prisma.$transaction(async (tx) => {
      await this.friendshipRepo.delete(command.requestId, tx);

      await tx.notification.updateMany({
        where: {
          type: 'friend.request.sent',
          referenceId: command.requestId
        },
        data: {
          status: 'declined'
        }
      });
    });
  }
}

export class CancelFriendRequestCommand_Handler {
  constructor(private readonly friendshipRepo: FriendshipRepository) {}

  async execute(command: CancelFriendRequestCommand): Promise<void> {
    const friendship = await this.friendshipRepo.findById(command.requestId);
    if (!friendship) throw new NotFoundError('Friend request not found');

    if (friendship.userId !== command.userId) {
      throw new ForbiddenError('Only the sender can cancel a pending request');
    }

    await this.friendshipRepo.delete(command.requestId);
  }
}

export class RemoveFriendHandler {
  constructor(private readonly friendshipRepo: FriendshipRepository) {}

  async execute(command: RemoveFriendCommand): Promise<void> {
    const friendship = await this.friendshipRepo.findFriendship(command.userId, command.friendId);
    if (!friendship || friendship.status !== 'accepted') {
      throw new NotFoundError('Friend relationship not found');
    }

    await this.friendshipRepo.delete(friendship.id);
    await EventBus.publish(new FriendRemovedEvent(command.userId, command.friendId));
  }
}

export class BlockUserHandler {
  constructor(
    private readonly blockRepo: BlockRepository,
    private readonly friendshipRepo: FriendshipRepository
  ) {}

  async execute(command: BlockUserCommand): Promise<any> {
    if (command.userId === command.targetUserId) {
      throw new BadRequestError('You cannot block yourself');
    }

    const existingBlock = await this.blockRepo.findBlock(command.userId, command.targetUserId);

    if (existingBlock) return existingBlock;

    return prisma.$transaction(async (tx) => {
      const block = await this.blockRepo.create({
        user: { connect: { id: command.userId } },
        blocked: { connect: { id: command.targetUserId } }
      }, tx);

      // Dissolve any existing friendships or pending requests between them
      const friendship = await this.friendshipRepo.findFriendship(command.userId, command.targetUserId, tx);
      if (friendship) {
        await this.friendshipRepo.delete(friendship.id, tx);
      }

      await EventBus.publish(new UserBlockedEvent(command.userId, command.targetUserId));
      return block;
    });
  }
}

export class UnblockUserHandler {
  constructor(private readonly blockRepo: BlockRepository) {}

  async execute(command: UnblockUserCommand): Promise<void> {
    const block = await this.blockRepo.findBlock(command.userId, command.targetUserId);

    if (!block) throw new NotFoundError('Block relationship not found');

    await this.blockRepo.delete(block.id);
    await EventBus.publish(new UserUnblockedEvent(command.userId, command.targetUserId));
  }
}

export class MarkNotificationReadHandler {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(command: MarkNotificationReadCommand): Promise<any> {
    const notification = await this.notificationRepo.findById(command.notificationId);
    if (!notification) throw new NotFoundError('Notification not found');

    if (!NotificationPolicy.canMutateNotification(command.userId, notification.userId)) {
      throw new ForbiddenError('You do not have permission to modify this notification');
    }

    const updated = await this.notificationRepo.update(command.notificationId, { read: true });
    await EventBus.publish(new NotificationReadEvent(command.notificationId, notification.userId));
    return updated;
  }
}

export class MarkAllNotificationsReadHandler {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(command: MarkAllNotificationsReadCommand): Promise<void> {
    await this.notificationRepo.markAllAsRead(command.userId);
  }
}
