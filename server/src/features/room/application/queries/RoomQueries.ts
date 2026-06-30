import { prisma } from '@infrastructure/db/PrismaClient.js';
import { getRoomActiveCount } from '@infrastructure/socket/SocketServer.js';
import { NotFoundError } from '@shared/errors/AppError.js';

// --- Helper function ---

export async function attachMessageCounts(rooms: any[], userId?: string) {
  if (rooms.length === 0) return rooms;
  const roomIds = rooms.map(r => r.id);
  const messageCounts = await prisma.message.groupBy({
    by: ['roomId'],
    where: {
      roomId: { in: roomIds },
      deleted: false
    },
    _count: {
      id: true
    }
  });

  const countsMap = new Map<string, number>(
    messageCounts.map(c => [c.roomId, c._count.id])
  );

  const joinedRoomIds = new Set<string>();
  if (userId) {
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId,
        roomId: { in: roomIds }
      },
      select: { roomId: true }
    });
    memberships.forEach(m => joinedRoomIds.add(m.roomId));
  }

  return rooms.map(r => ({
    ...r,
    activeNow: getRoomActiveCount(r.id),
    isJoined: userId ? joinedRoomIds.has(r.id) : false,
    _count: {
      ...r._count,
      messages: countsMap.get(r.id) || 0
    }
  }));
}

// --- Queries ---

export class GetRoomsQuery {
  constructor(
    public readonly requesterUserId?: string,
    public readonly communityId?: string,
    public readonly category?: string
  ) {}
}

export class GetTrendingRoomsQuery {
  constructor(public readonly requesterUserId?: string) {}
}

export class GetHotRoomsQuery {
  constructor(public readonly requesterUserId?: string) {}
}

export class GetNewRoomsQuery {
  constructor(public readonly requesterUserId?: string) {}
}

export class GetRoomByIdQuery {
  constructor(public readonly roomId: string) {}
}

export class GetRoomMessagesQuery {
  constructor(public readonly roomId: string) {}
}

// --- Handlers ---

export class GetRoomsHandler {
  async execute(query: GetRoomsQuery) {
    const filter: any = {};
    if (query.communityId) filter.communityId = query.communityId;
    if (query.category) filter.category = query.category;

    const rooms = await prisma.room.findMany({
      where: filter,
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return attachMessageCounts(rooms, query.requesterUserId);
  }
}

export class GetTrendingRoomsHandler {
  async execute(query: GetTrendingRoomsQuery) {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        },
        messages: {
          where: { createdAt: { gte: last24h }, deleted: false },
          select: { id: true }
        }
      },
      take: 20
    });

    const roomsWithCounts = await attachMessageCounts(rooms, query.requesterUserId);

    return roomsWithCounts
      .sort((a, b) => {
        const scoreA = a._count.messages;
        const scoreB = b._count.messages;
        if (a.trending && !b.trending) return -1;
        if (!a.trending && b.trending) return 1;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, 10);
  }
}

export class GetHotRoomsHandler {
  async execute(query: GetHotRoomsQuery) {
    const rooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      },
      take: 20
    });

    const roomsWithCounts = await attachMessageCounts(rooms, query.requesterUserId);

    return roomsWithCounts
      .sort((a, b) => {
        const scoreA = a._count.members;
        const scoreB = b._count.members;
        return scoreB - scoreA;
      })
      .slice(0, 10);
  }
}

export class GetNewRoomsHandler {
  async execute(query: GetNewRoomsQuery) {
    const newRooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: { select: { members: true, messages: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    });

    return attachMessageCounts(newRooms, query.requesterUserId);
  }
}

export class GetRoomByIdHandler {
  async execute(query: GetRoomByIdQuery) {
    const room = await prisma.room.findUnique({
      where: { id: query.roomId },
      include: {
        community: true,
        members: {
          include: { user: true },
          take: 24
        },
        _count: {
          select: { members: true, messages: true }
        }
      }
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const nonDeletedMessages = await prisma.message.count({
      where: { roomId: room.id, deleted: false }
    });
    room._count.messages = nonDeletedMessages;
    (room as any).activeNow = getRoomActiveCount(room.id);

    return room;
  }
}

export class GetRoomMessagesHandler {
  async execute(query: GetRoomMessagesQuery) {
    return prisma.message.findMany({
      where: { roomId: query.roomId, deleted: false, parentId: null },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            verified: true,
            role: true,
            reputation: true,
            badges: true
          }
        },
        reactions: {
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        },
        replies: {
          where: { deleted: false },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                avatar: true,
                verified: true,
                role: true,
                reputation: true,
                badges: true
              }
            },
            reactions: {
              include: {
                user: { select: { id: true, username: true } }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }
}
