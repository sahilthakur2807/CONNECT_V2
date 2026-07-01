import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchUsersHandler, SearchCommunitiesHandler, SearchRoomsHandler, SearchMessagesHandler, GetTrendingContentHandler, GetRecommendedCommunitiesHandler, SearchUsersQuery, SearchCommunitiesQuery, SearchRoomsQuery, SearchMessagesQuery, GetTrendingContentQuery, GetRecommendedCommunitiesQuery } from '../src/features/discovery/application/queries/DiscoveryQueries.js';
import { DiscoveryRepository } from '../src/features/discovery/infrastructure/repository/DiscoveryRepository.js';
import { PrismaSearchEngine } from '../src/features/discovery/infrastructure/search/PrismaSearchEngine.js';
import { prisma } from '../src/infrastructure/db/PrismaClient.js';

// Mock Prisma
vi.mock('../src/infrastructure/db/PrismaClient.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn()
    },
    community: {
      findMany: vi.fn()
    },
    room: {
      findMany: vi.fn()
    },
    message: {
      findMany: vi.fn()
    },
    communityMember: {
      findMany: vi.fn()
    }
  }
}));

describe('CONNECT Phase 7 Discovery & Search Unit Tests', () => {
  let mockSearchEngine: any;
  let mockDiscoveryRepo: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockSearchEngine = {
      searchUsers: vi.fn(),
      searchCommunities: vi.fn(),
      searchRooms: vi.fn(),
      searchMessages: vi.fn()
    };

    mockDiscoveryRepo = {
      findTrendingCommunities: vi.fn(),
      findTrendingRooms: vi.fn(),
      findRecommendedCommunities: vi.fn()
    };
  });

  // 1. Search Users
  describe('SearchUsersHandler', () => {
    it('should invoke searchUsers on the search engine', async () => {
      const handler = new SearchUsersHandler(mockSearchEngine);
      const query = new SearchUsersQuery('testuser', 10, 'cursor_id');

      mockSearchEngine.searchUsers.mockResolvedValue({ items: [], nextCursor: undefined });

      await handler.execute(query);

      expect(mockSearchEngine.searchUsers).toHaveBeenCalledWith({
        query: 'testuser',
        limit: 10,
        cursor: 'cursor_id'
      });
    });
  });

  // 2. Search Rooms with visibility check
  describe('SearchRoomsHandler', () => {
    it('should invoke searchRooms on searchEngine passing userId', async () => {
      const handler = new SearchRoomsHandler(mockSearchEngine);
      const query = new SearchRoomsQuery('usr_id_123', 'general', 15, 'room_cursor');

      mockSearchEngine.searchRooms.mockResolvedValue({ items: [], nextCursor: undefined });

      await handler.execute(query);

      expect(mockSearchEngine.searchRooms).toHaveBeenCalledWith({
        query: 'general',
        limit: 15,
        cursor: 'room_cursor'
      }, 'usr_id_123');
    });
  });

  // 3. Message Search Authorization Verification
  describe('SearchMessagesHandler', () => {
    it('should fetch permitted room IDs first and then pass them to the search engine', async () => {
      const handler = new SearchMessagesHandler(mockSearchEngine);
      const query = new SearchMessagesQuery('usr_searching', 'clean-room', 20, 'msg_cursor');

      // Mock User community memberships
      vi.mocked(prisma.communityMember.findMany).mockResolvedValue([
        { communityId: 'comm_1' }
      ] as any);

      // Mock Room fetches based on memberships + global rooms
      vi.mocked(prisma.room.findMany).mockResolvedValue([
        { id: 'room_1' },
        { id: 'room_global' }
      ] as any);

      mockSearchEngine.searchMessages.mockResolvedValue({ items: [], nextCursor: undefined });

      await handler.execute(query);

      expect(prisma.communityMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'usr_searching', banned: false },
        select: { communityId: true }
      });

      expect(prisma.room.findMany).toHaveBeenCalledWith({
        where: {
          deleted: false,
          OR: [
            { communityId: null },
            { communityId: { in: ['comm_1'] } }
          ]
        },
        select: { id: true }
      });

      expect(mockSearchEngine.searchMessages).toHaveBeenCalledWith({
        query: 'clean-room',
        limit: 20,
        cursor: 'msg_cursor'
      }, ['room_1', 'room_global']);
    });
  });

  // 4. Trending calculations
  describe('GetTrendingContentHandler', () => {
    it('should pull trending communities and rooms from the discovery repo', async () => {
      const handler = new GetTrendingContentHandler(mockDiscoveryRepo);
      const query = new GetTrendingContentQuery(5);

      mockDiscoveryRepo.findTrendingCommunities.mockResolvedValue([{ id: 'comm_trend_1' }]);
      mockDiscoveryRepo.findTrendingRooms.mockResolvedValue([{ id: 'room_trend_1' }]);

      const result = await handler.execute(query);

      expect(mockDiscoveryRepo.findTrendingCommunities).toHaveBeenCalledWith(5);
      expect(mockDiscoveryRepo.findTrendingRooms).toHaveBeenCalledWith(5);
      expect(result.communities).toHaveLength(1);
      expect(result.rooms).toHaveLength(1);
    });
  });

  // 5. Popular Recommendations
  describe('GetRecommendedCommunitiesHandler', () => {
    it('should request community recommendations for the user', async () => {
      const handler = new GetRecommendedCommunitiesHandler(mockDiscoveryRepo);
      const query = new GetRecommendedCommunitiesQuery('usr_id_123', 8);

      mockDiscoveryRepo.findRecommendedCommunities.mockResolvedValue([{ id: 'comm_rec_1' }]);

      const result = await handler.execute(query);

      expect(mockDiscoveryRepo.findRecommendedCommunities).toHaveBeenCalledWith('usr_id_123', 8);
      expect(result).toHaveLength(1);
    });
  });

  // 6. PrismaSearchEngine integration assertions
  describe('PrismaSearchEngine logic', () => {
    it('should map search parameters to prisma queries correctly', async () => {
      const engine = new PrismaSearchEngine();

      vi.mocked(prisma.user.findMany).mockResolvedValue([
        { id: 'usr_1', username: 'user1', name: 'User One', avatar: null, createdAt: new Date() }
      ] as any);

      const result = await engine.searchUsers({ query: 'user', limit: 1 });

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          role: { not: 'banned' },
          OR: [
            { username: { contains: 'user', mode: 'insensitive' } },
            { name: { contains: 'user', mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          createdAt: true
        },
        take: 2,
        orderBy: { id: 'asc' }
      });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeUndefined();
    });
  });
});
