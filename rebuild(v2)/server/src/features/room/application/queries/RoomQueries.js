import { NotFoundError } from "../../../../shared/errors/AppError.js";

// --- Queries ---

export class GetRoomsQuery {
  constructor(communityId, category, page = 1, limit = 20, userId) {
    this.communityId = communityId;
    this.category = category;
    this.page = page;
    this.limit = limit;
    this.userId = userId;
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
    return room;
  }
}
