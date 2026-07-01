import { FriendshipRepository } from '../../infrastructure/repository/FriendshipRepository.js';
import { NotificationRepository } from '../../infrastructure/repository/NotificationRepository.js';

// --- Queries ---

export class GetFriendsQuery {
  constructor(public readonly userId: string) {}
}

export class GetPendingRequestsQuery {
  constructor(public readonly userId: string) {}
}

export class GetNotificationsQuery {
  constructor(
    public readonly userId: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

// --- Handlers ---

export class GetFriendsHandler {
  constructor(private readonly friendshipRepo: FriendshipRepository) {}

  async execute(query: GetFriendsQuery): Promise<any[]> {
    return this.friendshipRepo.findFriends(query.userId);
  }
}

export class GetPendingRequestsHandler {
  constructor(private readonly friendshipRepo: FriendshipRepository) {}

  async execute(query: GetPendingRequestsQuery): Promise<any[]> {
    return this.friendshipRepo.findPendingRequests(query.userId);
  }
}

export class GetNotificationsHandler {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async execute(query: GetNotificationsQuery): Promise<any[]> {
    return this.notificationRepo.findHistory(query.userId, query.limit, query.cursor);
  }
}
