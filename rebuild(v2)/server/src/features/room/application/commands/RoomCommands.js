import { RoomPolicy } from "../RoomPolicy.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

// --- Commands ---

export class CreateRoomCommand {
  constructor(
    userId,
    title,
    description,
    category,
    tags,
    communityId,
    sourceUrl,
    imageUrl,
  ) {
    this.userId = userId;
    this.title = title;
    this.description = description;
    this.category = category;
    this.tags = tags;
    this.communityId = communityId;
    this.sourceUrl = sourceUrl;
    this.imageUrl = imageUrl;
  }
}

export class UpdateRoomCommand {
  constructor(userId, roomId, title, description, category, tags, imageUrl) {
    this.userId = userId;
    this.roomId = roomId;
    this.title = title;
    this.description = description;
    this.category = category;
    this.tags = tags;
    this.imageUrl = imageUrl;
  }
}

export class ArchiveRoomCommand {
  constructor(userId, roomId) {
    this.userId = userId;
    this.roomId = roomId;
  }
}

export class DeleteRoomCommand {
  constructor(userId, roomId, userRole) {
    this.userId = userId;
    this.roomId = roomId;
    this.userRole = userRole;
  }
}

// --- Domain Events ---

export class RoomCreatedEvent {
  eventName = "room.created";
  occurredAt = new Date();
  constructor(roomId, creatorId) {
    this.roomId = roomId;
    this.creatorId = creatorId;
  }
}

export class RoomArchivedEvent {
  eventName = "room.archived";
  occurredAt = new Date();
  constructor(roomId) {
    this.roomId = roomId;
  }
}

export class RoomDeletedEvent {
  eventName = "room.deleted";
  occurredAt = new Date();
  constructor(roomId) {
    this.roomId = roomId;
  }
}

// --- Handlers ---

export class CreateRoomHandler {
  constructor(roomRepo, communityRepo, membershipRepo) {
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    let communityOwnerId = null;
    let membership = null;

    if (command.communityId) {
      const community = await this.communityRepo.findById(command.communityId);
      if (!community || community.deleted)
        throw new NotFoundError("Target community not found");
      if (community.archived)
        throw new BadRequestError("Community is archived and locked");

      communityOwnerId = community.createdById;
      membership = await this.membershipRepo.findMember(
        command.userId,
        command.communityId,
      );
    }

    // Policy check
    const allowed = RoomPolicy.canCreateRoom(
      { id: command.userId, role: "" },
      command.communityId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to create rooms in this community",
      );

    const room = await this.roomRepo.create({
      title: command.title,
      description: command.description,
      category: command.category,
      tags: command.tags,
      sourceUrl: command.sourceUrl,
      imageUrl: command.imageUrl,
      createdBy: { connect: { id: command.userId } },
      ...(command.communityId
        ? { community: { connect: { id: command.communityId } } }
        : {}),
    });

    await EventBus.publish(new RoomCreatedEvent(room.id, command.userId));
    return room;
  }
}

export class UpdateRoomHandler {
  constructor(roomRepo, communityRepo, membershipRepo) {
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError("Room not found");

    let communityOwnerId = null;
    let membership = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(
          command.userId,
          room.communityId,
        );
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: "" },
      room.createdById,
      communityOwnerId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to update this room",
      );

    const data = {};
    if (command.title !== undefined) data.title = command.title;
    if (command.description !== undefined)
      data.description = command.description;
    if (command.category !== undefined) data.category = command.category;
    if (command.tags !== undefined) data.tags = command.tags;
    if (command.imageUrl !== undefined) data.imageUrl = command.imageUrl;

    return this.roomRepo.update(command.roomId, data);
  }
}

export class ArchiveRoomHandler {
  constructor(roomRepo, communityRepo, membershipRepo) {
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError("Room not found");

    let communityOwnerId = null;
    let membership = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(
          command.userId,
          room.communityId,
        );
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: "" },
      room.createdById,
      communityOwnerId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to archive this room",
      );

    const updated = await this.roomRepo.update(command.roomId, {
      archived: true,
    });
    await EventBus.publish(new RoomArchivedEvent(command.roomId));
    return updated;
  }
}

export class DeleteRoomHandler {
  constructor(roomRepo, communityRepo, membershipRepo) {
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const room = await this.roomRepo.findById(command.roomId);
    if (!room || room.deleted) throw new NotFoundError("Room not found");

    let communityOwnerId = null;
    let membership = null;

    if (room.communityId) {
      const community = await this.communityRepo.findById(room.communityId);
      if (community) {
        communityOwnerId = community.createdById;
        membership = await this.membershipRepo.findMember(
          command.userId,
          room.communityId,
        );
      }
    }

    // Policy check
    const allowed = RoomPolicy.canMutateRoom(
      { id: command.userId, role: command.userRole },
      room.createdById,
      communityOwnerId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to delete this room",
      );

    await this.roomRepo.update(command.roomId, { deleted: true });
    await EventBus.publish(new RoomDeletedEvent(command.roomId));
  }
}
