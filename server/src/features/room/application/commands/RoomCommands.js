import { RoomPolicy } from "../RoomPolicy.js";
import { extractHashtags } from "../../../../shared/utils/Sanitizer.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

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
    userRole,
  ) {
    this.userId = userId;
    this.title = title;
    this.description = description;
    this.category = category;
    this.tags = tags;
    this.communityId = communityId;
    this.sourceUrl = sourceUrl;
    this.imageUrl = imageUrl;
    this.userRole = userRole;
  }
}

export class UpdateRoomCommand {
  constructor(userId, roomId, title, description, category, tags, imageUrl, isPrivate, userRole) {
    this.userId = userId;
    this.roomId = roomId;
    this.title = title;
    this.description = description;
    this.category = category;
    this.tags = tags;
    this.imageUrl = imageUrl;
    this.isPrivate = isPrivate;
    this.userRole = userRole;
  }
}

export class ArchiveRoomCommand {
  constructor(userId, roomId, userRole) {
    this.userId = userId;
    this.roomId = roomId;
    this.userRole = userRole;
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
    // 1. Validation checks
    if (!command.title || command.title.trim().length < 10) {
      throw new BadRequestError("Room title must be at least 10 characters long");
    }
    const existingRoom = await prisma.room.findFirst({
      where: {
        title: { equals: command.title.trim(), mode: "insensitive" },
        deleted: false
      }
    });
    if (existingRoom) {
      throw new BadRequestError("Room title already exists");
    }

    if (!command.category || !command.category.trim()) {
      throw new BadRequestError("Category is required");
    }

    const coreCategories = [
      "politics",
      "technology",
      "economy",
      "environment",
      "world affairs",
      "science",
      "health",
      "culture",
      "sports",
      "all topics"
    ];

    const hashtags = await prisma.hashtag.findMany({
      include: {
        _count: {
          select: { rooms: true }
        }
      }
    });

    const promoted = hashtags
      .filter((h) => h._count.rooms > 50)
      .map((h) => h.name.toLowerCase());

    const allowedCategories = new Set([...coreCategories, ...promoted]);
    if (!allowedCategories.has(command.category.trim().toLowerCase())) {
      throw new BadRequestError("Invalid category selected. You must select an existing category.");
    }

    const normalizedTags = (command.tags || [])
      .map((t) => t.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean);

    if (normalizedTags.length === 0) {
      throw new BadRequestError("At least one hashtag is required");
    }

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
      { id: command.userId, role: command.userRole },
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
      ...(normalizedTags.length > 0
        ? {
            hashtags: {
              connectOrCreate: normalizedTags.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          }
        : {}),
    });

    // Automatically join creator as ROOM_MOD
    await prisma.roomMember.create({
      data: {
        userId: command.userId,
        roomId: room.id,
        status: "ROOM_MOD"
      }
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
    const allowed = RoomPolicy.canEditOrArchiveRoom(
      { id: command.userId, role: command.userRole },
      room.createdById,
      communityOwnerId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to update this room",
      );

    const isSiteAdmin = RoomPolicy.isSiteAdmin({ id: command.userId, role: command.userRole });

    // Enforce that only the room owner (creator) or a site admin can edit the title (room name)
    if (command.title !== undefined && room.createdById !== command.userId && !isSiteAdmin) {
      throw new ForbiddenError(
        "Only the owner can edit the name of the room",
      );
    }

    const data = {};
    if (command.title !== undefined) {
      const trimmedTitle = command.title.trim();
      if (trimmedTitle.length < 10) {
        throw new BadRequestError("Room title must be at least 10 characters long");
      }
      if (trimmedTitle.toLowerCase() !== room.title.toLowerCase()) {
        const existingRoom = await prisma.room.findFirst({
          where: {
            title: { equals: trimmedTitle, mode: "insensitive" },
            deleted: false
          }
        });
        if (existingRoom) {
          throw new BadRequestError("Room title already exists");
        }
      }
      if (isSiteAdmin) {
        data.title = trimmedTitle;
      } else {
        if (room.pendingNameRequest) {
          throw new BadRequestError("You already have a pending rename request for this room. Please wait for administrator approval.");
        }
        data.pendingNameRequest = trimmedTitle;
      }
    }
    if (command.description !== undefined)
      data.description = command.description;
    if (command.category !== undefined) data.category = command.category;
    if (command.tags !== undefined) data.tags = command.tags;
    if (command.imageUrl !== undefined) data.imageUrl = command.imageUrl;
    if (command.isPrivate !== undefined) data.isPrivate = command.isPrivate;

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
    const allowed = RoomPolicy.canEditOrArchiveRoom(
      { id: command.userId, role: command.userRole },
      room.createdById,
      communityOwnerId,
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to archive this room",
      );

    const updated = await this.roomRepo.update(command.roomId, {
      archived: !room.archived,
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
    const allowed = RoomPolicy.canDeleteRoom(
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
