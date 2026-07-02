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
        user: {
          select: {
            status: true,
          },
        },
      },
    };
  }

  mapRoom(room, userId) {
    if (!room) return null;
    const members = Array.isArray(room.members) ? room.members : [];
    const isJoined = userId ? members.some((m) => m.userId === userId) : false;
    const activeNow = members.filter((m) => m.user?.status === "online").length;

    return {
      ...room,
      isJoined,
      activeNow,
    };
  }

  /**
   * Finds visible rooms filtered by optional community or category, ignoring soft-deleted rooms.
   */
  async findVisibleRooms(
    communityId,
    category,
    page = 1,
    limit = 20,
    userId,
    tx,
  ) {
    const delegate = this.getDelegate(tx);
    const skip = (page - 1) * limit;

    const where = { deleted: false };
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

    return rooms.map((room) => this.mapRoom(room, userId));
  }

  /**
   * Database-level trending list query, sorted by active member count.
   */
  async findTrending(limit = 20, userId, tx) {
    const delegate = this.getDelegate(tx);
    const rooms = await delegate.findMany({
      where: {
        deleted: false,
        archived: false,
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

    return rooms.map((room) => this.mapRoom(room, userId));
  }

  /**
   * Database-level hot rooms query, sorted by total message count.
   */
  async findHot(limit = 20, userId, tx) {
    const delegate = this.getDelegate(tx);
    const rooms = await delegate.findMany({
      where: {
        deleted: false,
        archived: false,
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

    return rooms.map((room) => this.mapRoom(room, userId));
  }

  /**
   * Retrieves newest rooms.
   */
  async findNewest(limit = 20, userId, tx) {
    const rooms = await this.getDelegate(tx).findMany({
      where: {
        deleted: false,
        archived: false,
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

    return rooms.map((room) => this.mapRoom(room, userId));
  }

  /**
   * Overridden findRoomById helper that resolves user-scoped membership.
   */
  async findRoomById(id, userId, tx) {
    const delegate = this.getDelegate(tx);
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

    return this.mapRoom(room, userId);
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
}
export const roomRepository = new RoomRepository();
