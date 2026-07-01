import type { ISearchEngine } from '../ISearchEngine.js';
import { DiscoveryRepository } from '../../infrastructure/repository/DiscoveryRepository.js';
import { prisma } from '../../../../infrastructure/db/PrismaClient.js';

// --- Queries ---

export class SearchUsersQuery {
  constructor(
    public readonly query: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class SearchCommunitiesQuery {
  constructor(
    public readonly query: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class SearchRoomsQuery {
  constructor(
    public readonly userId: string,
    public readonly query: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class SearchMessagesQuery {
  constructor(
    public readonly userId: string,
    public readonly query: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class GetTrendingContentQuery {
  constructor(public readonly limit = 10) {}
}

export class GetRecommendedCommunitiesQuery {
  constructor(
    public readonly userId: string,
    public readonly limit = 10
  ) {}
}

// --- Handlers ---

export class SearchUsersHandler {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(query: SearchUsersQuery) {
    return this.searchEngine.searchUsers({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor
    });
  }
}

export class SearchCommunitiesHandler {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(query: SearchCommunitiesQuery) {
    return this.searchEngine.searchCommunities({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor
    });
  }
}

export class SearchRoomsHandler {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(query: SearchRoomsQuery) {
    return this.searchEngine.searchRooms({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor
    }, query.userId);
  }
}

export class SearchMessagesHandler {
  constructor(private readonly searchEngine: ISearchEngine) {}

  async execute(query: SearchMessagesQuery) {
    // 1. Establish strict permission checks: resolve community/room access scopes
    const memberships = await prisma.communityMember.findMany({
      where: { userId: query.userId, banned: false },
      select: { communityId: true }
    });
    
    const communityIds = memberships.map(m => m.communityId);

    const permittedRooms = await prisma.room.findMany({
      where: {
        deleted: false,
        OR: [
          { communityId: null },
          { communityId: { in: communityIds } }
        ]
      },
      select: { id: true }
    });

    const permittedRoomIds = permittedRooms.map(r => r.id);

    // 2. Perform message search over permitted rooms
    return this.searchEngine.searchMessages({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor
    }, permittedRoomIds);
  }
}

export class GetTrendingContentHandler {
  constructor(private readonly discoveryRepo: DiscoveryRepository) {}

  async execute(query: GetTrendingContentQuery) {
    const communities = await this.discoveryRepo.findTrendingCommunities(query.limit);
    const rooms = await this.discoveryRepo.findTrendingRooms(query.limit);
    return { communities, rooms };
  }
}

export class GetRecommendedCommunitiesHandler {
  constructor(private readonly discoveryRepo: DiscoveryRepository) {}

  async execute(query: GetRecommendedCommunitiesQuery) {
    return this.discoveryRepo.findRecommendedCommunities(query.userId, query.limit);
  }
}
