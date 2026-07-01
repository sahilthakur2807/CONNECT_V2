import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import type { ISearchEngine, SearchQueryOptions, SearchResultPage } from '../../application/ISearchEngine.js';
import type { Prisma } from '@prisma/client';

export class PrismaSearchEngine implements ISearchEngine {
  /**
   * Searches user directory, ignoring banned status profiles.
   */
  async searchUsers(options: SearchQueryOptions): Promise<SearchResultPage<any>> {
    const limit = options.limit || 20;
    const where: Prisma.UserWhereInput = {
      role: { not: 'banned' }, // Exclude banned user roles
      OR: [
        { username: { contains: options.query, mode: 'insensitive' } },
        { name: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        createdAt: true
      },
      take: limit + 1,
      orderBy: { id: 'asc' }
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches communities, filtering out soft-deleted ones.
   */
  async searchCommunities(options: SearchQueryOptions, userId?: string): Promise<SearchResultPage<any>> {
    const limit = options.limit || 20;
    const where: Prisma.CommunityWhereInput = {
      deleted: false,
      OR: [
        { name: { contains: options.query, mode: 'insensitive' } },
        { description: { contains: options.query, mode: 'insensitive' } }
      ]
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.community.findMany({
      where,
      include: {
        _count: {
          select: { members: true, rooms: true }
        }
      },
      take: limit + 1,
      orderBy: { id: 'asc' }
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches rooms, filtering by community membership permissions dynamically.
   */
  async searchRooms(options: SearchQueryOptions, userId?: string): Promise<SearchResultPage<any>> {
    const limit = options.limit || 20;
    
    // Filter conditions: matching title/description, non-deleted,
    // and EITHER global (communityId: null) OR user is active member of community
    const where: Prisma.RoomWhereInput = {
      deleted: false,
      OR: [
        { title: { contains: options.query, mode: 'insensitive' } },
        { description: { contains: options.query, mode: 'insensitive' } }
      ],
      AND: [
        {
          OR: [
            { communityId: null },
            userId
              ? {
                  community: {
                    members: {
                      some: {
                        userId,
                        banned: false
                      }
                    }
                  }
                }
              : { communityId: null }
          ]
        }
      ]
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.room.findMany({
      where,
      include: {
        community: {
          select: { id: true, name: true }
        },
        _count: {
          select: { members: true, messages: true }
        }
      },
      take: limit + 1,
      orderBy: { id: 'asc' }
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches messages, strictly matching authorized room IDs.
   */
  async searchMessages(options: SearchQueryOptions, permittedRoomIds: string[]): Promise<SearchResultPage<any>> {
    const limit = options.limit || 20;

    const where: Prisma.MessageWhereInput = {
      deleted: false,
      content: { contains: options.query, mode: 'insensitive' },
      roomId: { in: permittedRoomIds }
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.message.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true }
        },
        room: {
          select: { id: true, title: true }
        }
      },
      take: limit + 1,
      orderBy: { id: 'asc' }
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }
}
