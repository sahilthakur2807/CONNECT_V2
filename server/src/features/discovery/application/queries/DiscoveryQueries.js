import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Queries ---

export class SearchUsersQuery {
  constructor(query, limit = 20, cursor) {
    this.query = query;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class SearchCommunitiesQuery {
  constructor(query, limit = 20, cursor) {
    this.query = query;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class SearchRoomsQuery {
  constructor(userId, query, limit = 20, cursor) {
    this.userId = userId;
    this.query = query;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class SearchMessagesQuery {
  constructor(userId, query, limit = 20, cursor) {
    this.userId = userId;
    this.query = query;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class GetTrendingContentQuery {
  constructor(limit = 10) {
    this.limit = limit;
  }
}

export class GetRecommendedCommunitiesQuery {
  constructor(userId, limit = 10) {
    this.userId = userId;
    this.limit = limit;
  }
}

// --- Handlers ---

export class SearchUsersHandler {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  async execute(query) {
    return this.searchEngine.searchUsers({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}

export class SearchCommunitiesHandler {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  async execute(query) {
    return this.searchEngine.searchCommunities({
      query: query.query,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}

export class SearchRoomsHandler {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  async execute(query) {
    return this.searchEngine.searchRooms(
      {
        query: query.query,
        limit: query.limit,
        cursor: query.cursor,
      },
      query.userId,
    );
  }
}

export class SearchMessagesHandler {
  constructor(searchEngine) {
    this.searchEngine = searchEngine;
  }

  async execute(query) {
    // 1. Establish strict permission checks: resolve community/room access scopes
    const memberships = await prisma.communityMember.findMany({
      where: { userId: query.userId, banned: false },
      select: { communityId: true },
    });
    const communityIds = memberships.map((m) => m.communityId);

    const permittedRooms = await prisma.room.findMany({
      where: {
        deleted: false,
        OR: [{ communityId: null }, { communityId: { in: communityIds } }],
      },
      select: { id: true },
    });

    const permittedRoomIds = permittedRooms.map((r) => r.id);

    // 2. Perform message search over permitted rooms
    return this.searchEngine.searchMessages(
      {
        query: query.query,
        limit: query.limit,
        cursor: query.cursor,
      },
      permittedRoomIds,
    );
  }
}

export class GetTrendingContentHandler {
  constructor(discoveryRepo) {
    this.discoveryRepo = discoveryRepo;
  }

  async execute(query) {
    const communities = await this.discoveryRepo.findTrendingCommunities(
      query.limit,
    );
    const rooms = await this.discoveryRepo.findTrendingRooms(query.limit);
    return { communities, rooms };
  }
}

export class GetRecommendedCommunitiesHandler {
  constructor(discoveryRepo) {
    this.discoveryRepo = discoveryRepo;
  }

  async execute(query) {
    return this.discoveryRepo.findRecommendedCommunities(
      query.userId,
      query.limit,
    );
  }
}
