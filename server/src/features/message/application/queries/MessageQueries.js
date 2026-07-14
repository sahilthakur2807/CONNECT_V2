// --- Queries ---

export class GetRoomMessagesQuery {
  constructor(roomId, limit = 50, cursor, direction = "before") {
    this.roomId = roomId;
    this.limit = limit;
    this.cursor = cursor;
    this.direction = direction;
  }
}

export class GetMessageRepliesQuery {
  constructor(messageId) {
    this.messageId = messageId;
  }
}

// --- Handlers ---

export class GetRoomMessagesHandler {
  constructor(messageRepo) {
    this.messageRepo = messageRepo;
  }

  async execute(query) {
    if (query.direction === "after") {
      return this.messageRepo.findHistoryAfter(
        query.roomId,
        query.limit,
        query.cursor,
      );
    } else {
      return this.messageRepo.findHistoryBefore(
        query.roomId,
        query.limit,
        query.cursor,
      );
    }
  }
}

export class GetMessageRepliesHandler {
  constructor(messageRepo) {
    this.messageRepo = messageRepo;
  }

  async execute(query) {
    return this.messageRepo.findReplies(query.messageId);
  }
}
