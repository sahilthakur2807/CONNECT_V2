// --- Queries ---

export class GetFriendsQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

export class GetPendingRequestsQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

export class GetNotificationsQuery {
  constructor(userId, limit = 20, cursor) {
    this.userId = userId;
    this.limit = limit;
    this.cursor = cursor;
  }
}

// --- Handlers ---

export class GetFriendsHandler {
  constructor(friendshipRepo) {
    this.friendshipRepo = friendshipRepo;
  }

  async execute(query) {
    return this.friendshipRepo.findFriends(query.userId);
  }
}

export class GetPendingRequestsHandler {
  constructor(friendshipRepo) {
    this.friendshipRepo = friendshipRepo;
  }

  async execute(query) {
    return this.friendshipRepo.findPendingRequests(query.userId);
  }
}

export class GetNotificationsHandler {
  constructor(notificationRepo) {
    this.notificationRepo = notificationRepo;
  }

  async execute(query) {
    return this.notificationRepo.findHistory(
      query.userId,
      query.limit,
      query.cursor,
    );
  }
}
