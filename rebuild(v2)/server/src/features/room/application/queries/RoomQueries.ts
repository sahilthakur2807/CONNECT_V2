import { RoomRepository } from '../../infrastructure/repository/RoomRepository.js';
import { NotFoundError } from '../../../../shared/errors/AppError.js';

// --- Queries ---

export class GetRoomsQuery {
  constructor(
    public readonly communityId?: string,
    public readonly category?: string,
    public readonly page = 1,
    public readonly limit = 20,
    public readonly userId?: string
  ) {}
}

export class GetTrendingRoomsQuery {
  constructor(public readonly limit = 20, public readonly userId?: string) {}
}

export class GetHotRoomsQuery {
  constructor(public readonly limit = 20, public readonly userId?: string) {}
}

export class GetNewRoomsQuery {
  constructor(public readonly limit = 20, public readonly userId?: string) {}
}

export class GetRoomByIdQuery {
  constructor(public readonly roomId: string, public readonly userId?: string) {}
}

// --- Handlers ---

export class GetRoomsHandler {
  constructor(private readonly roomRepo: RoomRepository) {}

  async execute(query: GetRoomsQuery): Promise<any[]> {
    return this.roomRepo.findVisibleRooms(
      query.communityId,
      query.category,
      query.page,
      query.limit,
      query.userId
    );
  }
}

export class GetTrendingRoomsHandler {
  constructor(private readonly roomRepo: RoomRepository) {}

  async execute(query: GetTrendingRoomsQuery): Promise<any[]> {
    return this.roomRepo.findTrending(query.limit, query.userId);
  }
}

export class GetHotRoomsHandler {
  constructor(private readonly roomRepo: RoomRepository) {}

  async execute(query: GetHotRoomsQuery): Promise<any[]> {
    return this.roomRepo.findHot(query.limit, query.userId);
  }
}

export class GetNewRoomsHandler {
  constructor(private readonly roomRepo: RoomRepository) {}

  async execute(query: GetNewRoomsQuery): Promise<any[]> {
    return this.roomRepo.findNewest(query.limit, query.userId);
  }
}

export class GetRoomByIdHandler {
  constructor(private readonly roomRepo: RoomRepository) {}

  async execute(query: GetRoomByIdQuery): Promise<any> {
    const room = await this.roomRepo.findRoomById(query.roomId, query.userId);
    if (!room || room.deleted) {
      throw new NotFoundError('Room not found');
    }
    return room;
  }
}
