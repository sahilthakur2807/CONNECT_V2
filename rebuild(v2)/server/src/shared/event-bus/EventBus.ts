export interface IDomainEvent {
  readonly eventName: string;
  readonly occurredAt: Date;
}

export type DomainEventHandler<T extends IDomainEvent = any> = (event: T) => Promise<void> | void;

export class EventBus {
  private static handlers = new Map<string, Set<DomainEventHandler>>();

  /** Subscribe to a domain event */
  static subscribe<T extends IDomainEvent>(eventName: string, handler: DomainEventHandler<T>): void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);
  }

  /** Unsubscribe from a domain event */
  static unsubscribe<T extends IDomainEvent>(eventName: string, handler: DomainEventHandler<T>): void {
    const set = this.handlers.get(eventName);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(eventName);
      }
    }
  }

  /** Publish a domain event to all subscribers */
  static async publish<T extends IDomainEvent>(event: T): Promise<void> {
    const set = this.handlers.get(event.eventName);
    if (!set || set.size === 0) return;

    // Execute handlers concurrently
    await Promise.all(
      Array.from(set).map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(`[EventBus] Error in handler for event ${event.eventName}:`, error);
        }
      })
    );
  }
}
