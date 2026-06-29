import type { IDomainEvent } from '@shared/event-bus/EventBus.js';

export class MessageSentEvent implements IDomainEvent {
  readonly eventName = 'MessageSentEvent';
  readonly occurredAt = new Date();

  constructor(
    public readonly message: any,
    public readonly roomId: string,
    public readonly parentId?: string
  ) {}
}

export class MessageUpdatedEvent implements IDomainEvent {
  readonly eventName = 'MessageUpdatedEvent';
  readonly occurredAt = new Date();

  constructor(public readonly message: any) {}
}

export class MessageDeletedEvent implements IDomainEvent {
  readonly eventName = 'MessageDeletedEvent';
  readonly occurredAt = new Date();

  constructor(
    public readonly messageId: string,
    public readonly roomId: string
  ) {}
}

export class MessageReactedEvent implements IDomainEvent {
  readonly eventName = 'MessageReactedEvent';
  readonly occurredAt = new Date();

  constructor(
    public readonly messageId: string,
    public readonly emoji: string,
    public readonly userId: string,
    public readonly action: 'added' | 'removed'
  ) {}
}
