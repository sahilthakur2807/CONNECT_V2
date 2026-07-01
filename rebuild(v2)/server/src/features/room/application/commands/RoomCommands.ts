import { RoomRepository } from '../../infrastructure/repository/RoomRepository.js';
import { CommunityRepository } from '../../../community/infrastructure/repository/CommunityRepository.js';
import { CommunityMembershipRepository } from '../../../community/infrastructure/repository/CommunityMembershipRepository.js';
import { RoomPolicy } from '../RoomPolicy.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

// --- Commands ---

export class CreateRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly description: string,
    public readonly category: string,
    public readonly tags: string[],
    public readonly communityId?: string,
    public readonly sourceUrl?: string,
    public readonly imageUrl?: string
  ) {}
}

export class UpdateRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string,
    public readonly title?: string,
    public readonly description?: string,
    public readonly category?: string,
    public readonly tags?: string[],
    public readonly imageUrl?: string
  ) {}
}

export class ArchiveRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string
  ) {}
}

export class DeleteRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string,
    public readonly userRole: string
  ) {}
}

// --- Domain Events ---

export class RoomCreatedEvent implements IDomainEvent {
  readonly eventName = 'room.created';
  readonly occurredAt = new Date();
  constructor(public readonly roomId: string, public readonly creatorId: string) {}
}

export class RoomArchivedEvent implements IDomainEvent {
  readonly eventName = 'room.archived';
  readonly occurredAt = new Date();
  constructor(public readonly roomId: string) {}
}

export class RoomDeletedEvent implements IDomainEvent {
  readonly eventName = 'room.deleted';
  readonly occurredAt = new Date();
  constructor(public readonly roomId: string) {}
}

// --- Handlers ---

export class CreateRoomHandler {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: CreateRoomCommand): Promise<any> {
    let communityOwnerId: string | null = null;
    let membership: any = null;

    if (command.communityId) {
      const community = await this.communityRepo.findById(command.communityId);
      if (!community || community.deleted) throw new NotFoundError('Target community not found');
      if (community.archived) throw new BadRequestError('Community is archived and locked');

      communityOwnerId = community.createdById;
      membership = await this.membershipRepo.findMember(command.userId, command.communityId);
    }

    // Policy check
    const allowed = RoomPolicy.canCreateRoom(
      { id: command.userId, role: '' },
      command.communityId,
      membership || undefined
    );

    if (!allowed) throw new ForbiddenError('You do not have permission to create rooms in this community');

    const room = await this.roomRepo.create({
      title: command.title,
      description: command.description,
      category: command.category,
      tags: command.tags,
      sourceUrl: command.sourceUrl,
      imageUrl: command.imageUrl,
      createdBy: { connect: { id: command.userId } },
      ...(command.communityId ? { community: { connect: { id: command.communityId } } } : {})
    });

    await EventBus.publish(new RoomCreatedEvent(room.id, command.userId));
    return room;
  }
}

export class UpdateRoomHandler {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: UpdateRoomCommand): Promise<any> {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError('Room not found');

    let communityOwnerId: string | null = null;
    let membership: any = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(command.userId, room.communityId);
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: '' },
      room.createdById,
      communityOwnerId,
      membership || undefined
    );

    if (!allowed) throw new ForbiddenError('You do not have permission to update this room');

    const data: any = {};
    if (command.title !== undefined) data.title = command.title;
    if (command.description !== undefined) data.description = command.description;
    if (command.category !== undefined) data.category = command.category;
    if (command.tags !== undefined) data.tags = command.tags;
    if (command.imageUrl !== undefined) data.imageUrl = command.imageUrl;

    return this.roomRepo.update(command.roomId, data);
  }
}

export class ArchiveRoomHandler {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: ArchiveRoomCommand): Promise<any> {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError('Room not found');

    let communityOwnerId: string | null = null;
    let membership: any = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(command.userId, room.communityId);
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: '' },
      room.createdById,
      communityOwnerId,
      membership || undefined
    );

    if (!allowed) throw new ForbiddenError('You do not have permission to archive this room');

    const updated = await this.roomRepo.update(command.roomId, { archived: true });
    await EventBus.publish(new RoomArchivedEvent(command.roomId));
    return updated;
  }
}

export class DeleteRoomHandler {
  constructor(
    private readonly roomRepo: RoomRepository,
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: DeleteRoomCommand): Promise<void> {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError('Room not found');

    let communityOwnerId: string | null = null;
    let membership: any = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(command.userId, room.communityId);
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: command.userRole },
      room.createdById,
      communityOwnerId,
      membership || undefined
    );

    if (!allowed) throw new ForbiddenError('You do not have permission to delete this room');

    await this.roomRepo.update(command.roomId, { deleted: true });
    await EventBus.publish(new RoomDeletedEvent(command.roomId));
  }
}
