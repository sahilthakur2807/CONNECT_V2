import { MessageRepository } from '../../infrastructure/repository/MessageRepository.js';

// --- Queries ---

export class GetRoomMessagesQuery {
  constructor(
    public readonly roomId: string,
    public readonly limit = 50,
    public readonly cursor?: string,
    public readonly direction: 'before' | 'after' = 'before'
  ) {}
}

export class GetMessageRepliesQuery {
  constructor(public readonly messageId: string) {}
}

// --- Handlers ---

export class GetRoomMessagesHandler {
  constructor(private readonly messageRepo: MessageRepository) {}

  async execute(query: GetRoomMessagesQuery): Promise<any[]> {
    if (query.direction === 'after') {
      return this.messageRepo.findHistoryAfter(query.roomId, query.limit, query.cursor);
    } else {
      return this.messageRepo.findHistoryBefore(query.roomId, query.limit, query.cursor);
    }
  }
}

export class GetMessageRepliesHandler {
  constructor(private readonly messageRepo: MessageRepository) {}

  async execute(query: GetMessageRepliesQuery): Promise<any[]> {
    return this.messageRepo.findReplies(query.messageId);
  }
}
