import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class RoomRepository extends BaseRepository {
  constructor() {
    super(prisma.room, "room");
  }

  /**
   * Finds visible rooms filtered by optional community or category, ignoring soft-deleted rooms.
   */
  getMembersInclude(userId) {
    return {
      where: userId
        ? {
            OR: [{ userId }, { user: { status: "online" } }],
          }
        : {
            user: { status: "online" },
          },
      select: {
        userId: true,
        status: true,
        user: {
          select: {
            status: true,
          },
        },
      },
    };
  }

  async getGlobalBadgesInfo(tx) {
    const delegate = this.getDelegate(tx);
    const N = 5;
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const newRooms = await delegate.findMany({
      where: { deleted: false, createdAt: { gte: twoDaysAgo }, title: { not: "World Chat" } },
      orderBy: { createdAt: "desc" },
      take: N,
      select: { id: true }
    });

    const trendingRooms = await delegate.findMany({
      where: { deleted: false, createdAt: { gte: twoDaysAgo }, title: { not: "World Chat" } },
      orderBy: { members: { _count: "desc" } },
      take: N,
      select: { id: true }
    });

    const hotRooms = await delegate.findMany({
      where: { deleted: false, title: { not: "World Chat" } },
      orderBy: { messages: { _count: "desc" } },
      take: N,
      select: { id: true }
    });

    return {
      newIds: new Set(newRooms.map(r => r.id)),
      trendingIds: new Set(trendingRooms.map(r => r.id)),
      hotIds: new Set(hotRooms.map(r => r.id))
    };
  }

  mapRoom(room, userId, badgeInfo = null) {
    if (!room) return null;
    const members = Array.isArray(room.members) ? room.members : [];
    const membership = userId ? members.find((m) => m.userId === userId) : null;
    const isJoined = membership ? membership.status === "joined" : false;
    const isPending = membership ? membership.status === "pending" : false;
    const activeNow = members.filter((m) => m.user?.status === "online").length;

    const isNew = badgeInfo ? badgeInfo.newIds.has(room.id) : (room.isNew ?? false);
    const trending = badgeInfo ? badgeInfo.trendingIds.has(room.id) : (room.trending ?? false);
    const isHot = badgeInfo ? badgeInfo.hotIds.has(room.id) : false;

    return {
      ...room,
      isJoined,
      isPending,
      activeNow,
      isNew,
      trending,
      isHot,
    };
  }

  /**
   * Finds visible rooms filtered by optional community or category, ignoring soft-deleted rooms.
   */
  async getPrivateRoomFilter(userId) {
    if (!userId) {
      return {
        isPrivate: false
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const isPlatformStaff = user && ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(user.role?.toUpperCase());
    if (isPlatformStaff) {
      return {};
    }

    return {
      OR: [
        { isPrivate: false },
        { createdById: userId },
        { members: { some: { userId, status: { in: ["joined", "ROOM_MOD"] } } } }
      ]
    };
  }

  async findVisibleRooms(
    communityId,
    category,
    page = 1,
    limit = 20,
    userId,
    includeWorldChat = false,
    tx,
  ) {
    const delegate = this.getDelegate(tx);
    const skip = (page - 1) * limit;
    const badgeInfo = await this.getGlobalBadgesInfo(tx);
    const privateFilter = await this.getPrivateRoomFilter(userId);

    const where = {
      deleted: false,
      OR: [
        { archived: false },
        ...(userId ? [{ createdById: userId }] : []),
      ],
      ...privateFilter,
    };
    if (!includeWorldChat) {
      where.title = { not: "World Chat" };
    }
    if (communityId) where.communityId = communityId;
    if (category) where.category = { equals: category, mode: "insensitive" };

    const rooms = await delegate.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: this.getMembersInclude(userId),
        _count: {
          select: { members: true, messages: true },
        },
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    return rooms.map((room) => this.mapRoom(room, userId, badgeInfo));
  }

  /**
   * Database-level trending list query, sorted by active member count.
   */
  async findTrending(limit = 20, userId, tx) {
    const delegate = this.getDelegate(tx);
    const badgeInfo = await this.getGlobalBadgesInfo(tx);
    const privateFilter = await this.getPrivateRoomFilter(userId);
    const rooms = await delegate.findMany({
      where: {
        deleted: false,
        title: { not: "World Chat" },
        OR: [
          { archived: false },
          ...(userId ? [{ createdById: userId }] : []),
        ],
        ...privateFilter,
      },
      include: {
        members: this.getMembersInclude(userId),
        _count: {
          select: { members: true, messages: true },
        },
      },
      orderBy: {
        members: {
          _count: "desc",
        },
      },
      take: limit,
    });

    return rooms.map((room) => this.mapRoom(room, userId, badgeInfo));
  }

  /**
   * Database-level hot rooms query, sorted by total message count.
   */
  async findHot(limit = 20, userId, tx) {
    const delegate = this.getDelegate(tx);
    const badgeInfo = await this.getGlobalBadgesInfo(tx);
    const privateFilter = await this.getPrivateRoomFilter(userId);
    const rooms = await delegate.findMany({
      where: {
        deleted: false,
        title: { not: "World Chat" },
        OR: [
          { archived: false },
          ...(userId ? [{ createdById: userId }] : []),
        ],
        ...privateFilter,
      },
      include: {
        members: this.getMembersInclude(userId),
        _count: {
          select: { members: true, messages: true },
        },
      },
      orderBy: {
        messages: {
          _count: "desc",
        },
      },
      take: limit,
    });

    return rooms.map((room) => this.mapRoom(room, userId, badgeInfo));
  }

  /**
   * Retrieves newest rooms.
   */
  async findNewest(limit = 20, userId, tx) {
    const badgeInfo = await this.getGlobalBadgesInfo(tx);
    const privateFilter = await this.getPrivateRoomFilter(userId);
    const rooms = await this.getDelegate(tx).findMany({
      where: {
        deleted: false,
        title: { not: "World Chat" },
        OR: [
          { archived: false },
          ...(userId ? [{ createdById: userId }] : []),
        ],
        ...privateFilter,
      },
      include: {
        members: this.getMembersInclude(userId),
        _count: {
          select: { members: true, messages: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return rooms.map((room) => this.mapRoom(room, userId, badgeInfo));
  }

  /**
   * Overridden findRoomById helper that resolves user-scoped membership.
   */
  async findRoomById(id, userId, tx) {
    const delegate = this.getDelegate(tx);
    const badgeInfo = await this.getGlobalBadgesInfo(tx);
    const room = await delegate.findFirst({
      where: { id, deleted: false },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: this.getMembersInclude(userId),
        _count: {
          select: { members: true, messages: true },
        },
      },
    });

    return this.mapRoom(room, userId, badgeInfo);
  }

  /**
   * Links a room with hashtags in the database.
   */
  async associateHashtags(roomId, hashtagNames, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.update({
      where: { id: roomId },
      data: {
        hashtags: {
          connectOrCreate: hashtagNames.map((name) => ({
            where: { name },
            create: { name },
          })),
        },
      },
    });
  }

  async findMembership(userId, roomId, tx) {
    const delegate = tx ? tx.roomMember : prisma.roomMember;
    return delegate.findUnique({
      where: {
        userId_roomId: { userId, roomId },
      },
    });
  }

  async createMembership(userId, roomId, status, tx) {
    const delegate = tx ? tx.roomMember : prisma.roomMember;
    return delegate.create({
      data: { userId, roomId, status },
    });
  }

  async deleteMembership(userId, roomId, tx) {
    const delegate = tx ? tx.roomMember : prisma.roomMember;
    return delegate.deleteMany({
      where: { userId, roomId },
    });
  }

  async findPendingMembers(roomId, tx) {
    const delegate = tx ? tx.roomMember : prisma.roomMember;
    return delegate.findMany({
      where: {
        roomId,
        status: "pending",
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  }

  async updateMembershipStatus(userId, roomId, status, tx) {
    const delegate = tx ? tx.roomMember : prisma.roomMember;
    return delegate.update({
      where: {
        userId_roomId: { userId, roomId },
      },
      data: {
        status,
      },
    });
  }
}
export const roomRepository = new RoomRepository();
