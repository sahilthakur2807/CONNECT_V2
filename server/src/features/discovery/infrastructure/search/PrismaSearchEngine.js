import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

export class PrismaSearchEngine {
  /**
   * Searches user directory, ignoring banned status profiles.
   */
  async searchUsers(options) {
    const limit = options.limit || 20;
    const where = {
      role: { not: "banned" }, // Exclude banned user roles
      isDeleted: false,
      OR: [
        { username: { contains: options.query, mode: "insensitive" } },
        { name: { contains: options.query, mode: "insensitive" } },
      ],
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
        createdAt: true,
      },
      take: limit + 1,
      orderBy: { id: "asc" },
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches communities, filtering out soft-deleted ones.
   */
  async searchCommunities(options, userId) {
    const limit = options.limit || 20;
    const where = {
      deleted: false,
      OR: [
        { name: { contains: options.query, mode: "insensitive" } },
        { description: { contains: options.query, mode: "insensitive" } },
      ],
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.community.findMany({
      where,
      include: {
        _count: {
          select: { members: true, rooms: true },
        },
      },
      take: limit + 1,
      orderBy: { id: "asc" },
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches rooms, filtering by community membership permissions dynamically.
   */
  async searchRooms(options, userId) {
    const limit = options.limit || 20;
    // Filter conditions: matching title/description, non-deleted,
    // and EITHER global (communityId: null) OR user is active member of community
    const where = {
      deleted: false,
      OR: [
        { title: { contains: options.query, mode: "insensitive" } },
        { description: { contains: options.query, mode: "insensitive" } },
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
                        banned: false,
                      },
                    },
                  },
                }
              : { communityId: null },
          ],
        },
      ],
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.room.findMany({
      where,
      include: {
        community: {
          select: { id: true, name: true },
        },
        _count: {
          select: { members: true, messages: true },
        },
      },
      take: limit + 1,
      orderBy: { id: "asc" },
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }

  /**
   * Searches messages, strictly matching authorized room IDs.
   */
  async searchMessages(options, permittedRoomIds) {
    const limit = options.limit || 20;

    const where = {
      deleted: false,
      content: { contains: options.query, mode: "insensitive" },
      roomId: { in: permittedRoomIds },
    };

    if (options.cursor) {
      where.id = { gt: options.cursor };
    }

    const items = await prisma.message.findMany({
      where,
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        room: {
          select: { id: true, title: true },
        },
      },
      take: limit + 1,
      orderBy: { id: "asc" },
    });

    let nextCursor = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return { items, nextCursor };
  }
}
