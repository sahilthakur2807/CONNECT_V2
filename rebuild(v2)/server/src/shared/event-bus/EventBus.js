export class EventBus {
  static handlers = new Map();

  /** Subscribe to a domain event */
  static subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName).add(handler);
  }

  /** Unsubscribe from a domain event */
  static unsubscribe(eventName, handler) {
    const set = this.handlers.get(eventName);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(eventName);
      }
    }
  }

  /** Publish a domain event to all subscribers */
  static async publish(event) {
    const set = this.handlers.get(event.eventName);
    if (!set || set.size === 0) return;

    // Execute handlers concurrently
    await Promise.all(
      Array.from(set).map(async (handler) => {
        try {
          await handler(event);
        } catch (error) {
          console.error(
            `[EventBus] Error in handler for event ${event.eventName}:`,
            error,
          );
        }
      }),
    );
  }
}
