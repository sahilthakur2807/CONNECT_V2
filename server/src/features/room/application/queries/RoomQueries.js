import { ForbiddenError, NotFoundError } from "../../../../shared/errors/AppError.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Queries ---

export class GetRoomsQuery {
  constructor(communityId, category, page = 1, limit = 20, userId, includeWorldChat = false) {
    this.communityId = communityId;
    this.category = category;
    this.page = page;
    this.limit = limit;
    this.userId = userId;
    this.includeWorldChat = includeWorldChat;
  }
}

export class GetTrendingRoomsQuery {
  constructor(limit = 20, userId) {
    this.limit = limit;
    this.userId = userId;
  }
}

export class GetHotRoomsQuery {
  constructor(limit = 20, userId) {
    this.limit = limit;
    this.userId = userId;
  }
}

export class GetNewRoomsQuery {
  constructor(limit = 20, userId) {
    this.limit = limit;
    this.userId = userId;
  }
}

export class GetRoomByIdQuery {
  constructor(roomId, userId) {
    this.roomId = roomId;
    this.userId = userId;
  }
}

// --- Handlers ---

export class GetRoomsHandler {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  async execute(query) {
    return this.roomRepo.findVisibleRooms(
      query.communityId,
      query.category,
      query.page,
      query.limit,
      query.userId,
      query.includeWorldChat,
    );
  }
}

export class GetTrendingRoomsHandler {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  async execute(query) {
    return this.roomRepo.findTrending(query.limit, query.userId);
  }
}

export class GetHotRoomsHandler {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  async execute(query) {
    return this.roomRepo.findHot(query.limit, query.userId);
  }
}

export class GetNewRoomsHandler {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  async execute(query) {
    return this.roomRepo.findNewest(query.limit, query.userId);
  }
}

export class GetRoomByIdHandler {
  constructor(roomRepo) {
    this.roomRepo = roomRepo;
  }

  async execute(query) {
    const room = await this.roomRepo.findRoomById(query.roomId, query.userId);
    if (!room || room.deleted) {
      throw new NotFoundError("Room not found");
    }

    if (room.isPrivate) {
      if (!query.userId) {
        throw new ForbiddenError("This room is private");
      }

      const user = await prisma.user.findUnique({
        where: { id: query.userId },
        select: { role: true }
      });

      const isPlatformStaff = user && ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(user.role?.toUpperCase());
      const isRoomCreator = room.createdById === query.userId;

      const roomMember = await prisma.roomMember.findUnique({
        where: {
          userId_roomId: {
            userId: query.userId,
            roomId: room.id
          }
        }
      });
      const isRoomMod = roomMember && roomMember.status === "ROOM_MOD";

      if (!isPlatformStaff && !isRoomCreator && !isRoomMod) {
        throw new ForbiddenError("This room is private and you do not have permission to view it");
      }
    }
    return room;
  }
}
