import { prisma } from '@infrastructure/db/PrismaClient.js';
import { NotFoundError } from '@shared/errors/AppError.js';
import { attachMessageCounts } from '@features/room/application/queries/RoomQueries.js';

// --- Queries ---

export class GetUsersQuery {
  constructor(public readonly requesterRole?: string) {}
}

export class GetActiveUsersQuery {
  constructor(public readonly requesterRole?: string) {}
}

export class GetActiveFriendsQuery {
  constructor(public readonly userId: string) {}
}

export class SearchUsersByUsernameQuery {
  constructor(
    public readonly userId: string,
    public readonly queryText: string
  ) {}
}

export class GetUserProfileQuery {
  constructor(public readonly userId: string) {}
}

export class GetUserMessagesQuery {
  constructor(public readonly userId: string) {}
}

export class GetUserRoomsQuery {
  constructor(
    public readonly userId: string,
    public readonly requesterUserId?: string
  ) {}
}

// --- Handlers ---

export class GetUsersHandler {
  async execute(query: GetUsersQuery) {
    const isRequesterAdmin = query.requesterRole === 'admin' || query.requesterRole === 'superadmin';
    const filter = isRequesterAdmin ? {} : { role: { notIn: ['admin', 'superadmin'] } };

    return prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true,
        _count: {
          select: { messages: true, rooms: true }
        }
      },
      orderBy: { reputation: 'desc' }
    });
  }
}

export class GetActiveUsersHandler {
  async execute(query: GetActiveUsersQuery) {
    const isRequesterAdmin = query.requesterRole === 'admin' || query.requesterRole === 'superadmin';
    const filter = isRequesterAdmin 
      ? { status: 'online' } 
      : { status: 'online', role: { notIn: ['admin', 'superadmin'] } };

    return prisma.user.findMany({
      where: filter,
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true
      },
      take: 12
    });
  }
}

export class GetActiveFriendsHandler {
  async execute(query: GetActiveFriendsQuery) {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: query.userId },
          { friendId: query.userId }
        ]
      },
      include: {
        user: true,
        friend: true
      }
    });

    return friendships
      .map(f => f.userId === query.userId ? f.friend : f.user)
      .map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar,
        badges: u.badges,
        status: u.status,
        role: u.role
      }))
      .sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.name || a.username).localeCompare(b.name || b.username);
      });
  }
}

export class SearchUsersByUsernameHandler {
  async execute(query: SearchUsersByUsernameQuery) {
    if (!query.queryText) return [];

    const matchedUsers = await prisma.user.findMany({
      where: {
        username: { contains: query.queryText, mode: 'insensitive' },
        id: { not: query.userId },
        role: { not: 'admin' }
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        badges: true
      },
      take: 10
    });

    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: query.userId },
          { friendId: query.userId }
        ]
      }
    });

    const friendIds = new Set(friendships.map(f => f.userId === query.userId ? f.friendId : f.userId));

    return matchedUsers.map(u => ({
      ...u,
      isFriend: friendIds.has(u.id)
    }));
  }
}

export class GetUserProfileHandler {
  async execute(query: GetUserProfileQuery) {
    const user = await prisma.user.findUnique({
      where: { id: query.userId },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true,
        _count: {
          select: { messages: true, rooms: true, createdRooms: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}

export class GetUserMessagesHandler {
  async execute(query: GetUserMessagesQuery) {
    return prisma.message.findMany({
      where: { userId: query.userId, deleted: false },
      include: {
        room: true,
        user: { select: { id: true, username: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }
}

export class GetUserRoomsHandler {
  async execute(query: GetUserRoomsQuery) {
    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: { userId: query.userId }
        }
      },
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
