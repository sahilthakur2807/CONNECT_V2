import { MessageRepository } from '../../infrastructure/repository/MessageRepository.js';
import { RoomRepository } from '../../../room/infrastructure/repository/RoomRepository.js';
import { CommunityRepository } from '../../../community/infrastructure/repository/CommunityRepository.js';
import { CommunityMembershipRepository } from '../../../community/infrastructure/repository/CommunityMembershipRepository.js';
import { MessagePolicy } from '../MessagePolicy.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';
import { io } from '../../../../infrastructure/socket/SocketServer.js';

// --- Commands ---

export class SendMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string,
    public readonly content: string,
    public readonly clientMessageId?: string,
    public readonly parentId?: string
  ) {}
}

export class EditMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly messageId: string,
    public readonly content: string
  ) {}
}

export class DeleteMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly messageId: string,
    public readonly userRole: string
  ) {}
}

export class RestoreMessageCommand {
  constructor(
    public readonly userId: string,
    public readonly messageId: string
  ) {}
}

// --- Domain Events ---

export class MessageCreatedEvent implements IDomainEvent {
  readonly eventName = 'message.created';
  readonly occurredAt = new Date();
  constructor(public readonly messageId: string, public readonly roomId: string) {}
}

export class MessageUpdatedEvent implements IDomainEvent {
  readonly eventName = 'message.updated';
  readonly occurredAt = new Date();
  constructor(public readonly messageId: string, public readonly roomId: string) {}
}

export class MessageDeletedEvent implements IDomainEvent {
  readonly eventName = 'message.deleted';
  readonly occurredAt = new Date();
  constructor(public readonly messageId: string, public readonly roomId: string) {}
}

export class MessageRestoredEvent implements IDomainEvent {
  readonly eventName = 'message.restored';
  readonly occurredAt = new Date();
  constructor(public readonly messageId: string, public readonly roomId: string) {}
}

// --- Handlers ---

export class SendMessageHandler {
  constructor(
    private readonly messageRepo: MessageRepository,
    private readonly roomRepo: RoomRepository,
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: SendMessageCommand): Promise<any> {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError('Room not found');
    if (room.archived) throw new BadRequestError('Room is archived and read-only');

    // 1. Idempotency Check
    if (command.clientMessageId) {
      const existing = await this.messageRepo.findByClientMessageId(command.clientMessageId);
      if (existing) {
        return existing; // Return duplicate message without insertion
      }
    }

    // 2. Fetch membership context
    let membership: any = null;
    if (room.communityId) {
      membership = await this.membershipRepo.findMember(command.userId, room.communityId);
    }

    // 3. Policy Authorization
    const allowed = MessagePolicy.canSend(
      { id: command.userId, role: '' },
      membership || undefined
    );
    if (!allowed) throw new ForbiddenError('You are banned or muted in this community');

    // 4. Persistence
    const message = await this.messageRepo.create({
      content: command.content,
      clientMessageId: command.clientMessageId,
      user: { connect: { id: command.userId } },
      room: { connect: { id: command.roomId } },
      ...(command.parentId ? { parent: { connect: { id: command.parentId } } } : {})
    });

    // 5. Query full message details (including user details) for broadcast
    const fullMessage = await this.messageRepo.findById(message.id);

    // 6. Domain Event
    await EventBus.publish(new MessageCreatedEvent(message.id, command.roomId));

    // 7. Realtime Broadcast
    if (io) {
      io.to(command.roomId).emit('chat.message.created', {
        success: true,
        data: fullMessage
      });
    }

    return fullMessage;
  }
}

export class EditMessageHandler {
  constructor(
    private readonly messageRepo: MessageRepository
  ) {}

  async execute(command: EditMessageCommand): Promise<any> {
    const message = await this.messageRepo.findById(command.messageId);
    if (!message || message.deleted) throw new NotFoundError('Message not found');

    const allowed = MessagePolicy.canMutate({ id: command.userId, role: '' }, message.userId);
    if (!allowed) throw new ForbiddenError('You do not have permission to edit this message');

    const updated = await this.messageRepo.update(command.messageId, {
      content: command.content,
      edited: true
    });

    await EventBus.publish(new MessageUpdatedEvent(message.id, message.roomId));

    if (io) {
      io.to(message.roomId).emit('chat.message.updated', {
        success: true,
        data: updated
      });
    }

    return updated;
  }
}

export class DeleteMessageHandler {
  constructor(
    private readonly messageRepo: MessageRepository
  ) {}

  async execute(command: DeleteMessageCommand): Promise<void> {
    const message = await this.messageRepo.findById(command.messageId);
    if (!message || message.deleted) throw new NotFoundError('Message not found');

    const allowed = MessagePolicy.canMutate({ id: command.userId, role: command.userRole }, message.userId);
    if (!allowed) throw new ForbiddenError('You do not have permission to delete this message');

    await this.messageRepo.update(command.messageId, { deleted: true });

    await EventBus.publish(new MessageDeletedEvent(message.id, message.roomId));

    if (io) {
      io.to(message.roomId).emit('chat.message.deleted', {
        success: true,
        data: { id: message.id }
      });
    }
  }
}

export class RestoreMessageHandler {
  constructor(
    private readonly messageRepo: MessageRepository
  ) {}

  async execute(command: RestoreMessageCommand): Promise<any> {
    // Explicitly search raw database context or override soft delete filter
    const message = await this.messageRepo.findById(command.messageId);
    if (!message) throw new NotFoundError('Message not found');

    const allowed = MessagePolicy.canMutate({ id: command.userId, role: '' }, message.userId);
    if (!allowed) throw new ForbiddenError('You do not have permission to restore this message');

    const updated = await this.messageRepo.update(command.messageId, { deleted: false });

    await EventBus.publish(new MessageRestoredEvent(message.id, message.roomId));

    if (io) {
      io.to(message.roomId).emit('chat.message.restored', {
        success: true,
        data: updated
      });
    }

    return updated;
  }
}
