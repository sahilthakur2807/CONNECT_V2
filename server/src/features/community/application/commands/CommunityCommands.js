import { CommunityPolicy } from "../CommunityPolicy.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Commands ---

export class CreateCommunityCommand {
  constructor(userId, name, description, category, imageUrl, banner) {
    this.userId = userId;
    this.name = name;
    this.description = description;
    this.category = category;
    this.imageUrl = imageUrl;
    this.banner = banner;
  }
}

export class UpdateCommunityCommand {
  constructor(userId, communityId, description, imageUrl, banner) {
    this.userId = userId;
    this.communityId = communityId;
    this.description = description;
    this.imageUrl = imageUrl;
    this.banner = banner;
  }
}

export class ArchiveCommunityCommand {
  constructor(userId, communityId) {
    this.userId = userId;
    this.communityId = communityId;
  }
}

export class DeleteCommunityCommand {
  constructor(userId, communityId, userRole) {
    this.userId = userId;
    this.communityId = communityId;
    this.userRole = userRole;
  }
}

export class TransferOwnershipCommand {
  constructor(userId, communityId, targetUserId) {
    this.userId = userId;
    this.communityId = communityId;
    this.targetUserId = targetUserId;
  }
}

export class JoinCommunityCommand {
  constructor(userId, communityId) {
    this.userId = userId;
    this.communityId = communityId;
  }
}

export class LeaveCommunityCommand {
  constructor(userId, communityId) {
    this.userId = userId;
    this.communityId = communityId;
  }
}

// --- Domain Events ---

export class CommunityCreatedEvent {
  eventName = "community.created";
  occurredAt = new Date();
  constructor(communityId, ownerId) {
    this.communityId = communityId;
    this.ownerId = ownerId;
  }
}

export class CommunityArchivedEvent {
  eventName = "community.archived";
  occurredAt = new Date();
  constructor(communityId) {
    this.communityId = communityId;
  }
}

export class CommunityDeletedEvent {
  eventName = "community.deleted";
  occurredAt = new Date();
  constructor(communityId) {
    this.communityId = communityId;
  }
}

export class MembershipCreatedEvent {
  eventName = "membership.created";
  occurredAt = new Date();
  constructor(userId, communityId) {
    this.userId = userId;
    this.communityId = communityId;
  }
}

export class MembershipRemovedEvent {
  eventName = "membership.removed";
  occurredAt = new Date();
  constructor(userId, communityId) {
    this.userId = userId;
    this.communityId = communityId;
  }
}

// --- Handlers ---

export class CreateCommunityHandler {
  constructor(communityRepo, membershipRepo) {
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const existing = await this.communityRepo.findByName(command.name);
    if (existing) {
      throw new BadRequestError(
        `Community name "${command.name}" is already taken`,
      );
    }

    // Run creation inside database transaction to ensure creator membership is joined atomically
    return prisma.$transaction(async (tx) => {
      const community = await this.communityRepo.create(
        {
          name: command.name,
          description: command.description,
          category: command.category,
          imageUrl: command.imageUrl,
          banner: command.banner,
          createdBy: { connect: { id: command.userId } },
        },
        tx,
      );

      // Creator automatically becomes owner
      await this.membershipRepo.create(
        {
          role: "owner",
          user: { connect: { id: command.userId } },
          community: { connect: { id: community.id } },
        },
        tx,
      );

      await EventBus.publish(
        new CommunityCreatedEvent(community.id, command.userId),
      );
      return community;
    });
  }
}

export class UpdateCommunityHandler {
  constructor(communityRepo, membershipRepo) {
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");

    const membership = await this.membershipRepo.findMember(
      command.userId,
      command.communityId,
    );
    // Policy Check
    const allowed = CommunityPolicy.canUpdate(
      { id: command.userId, role: "" }, // we don't have user site role here, default to empty
      community.createdById || "",
      membership || undefined,
    );

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to edit this community",
      );

    const data = {};
    if (command.description !== undefined)
      data.description = command.description;
    if (command.imageUrl !== undefined) data.imageUrl = command.imageUrl;
    if (command.banner !== undefined) data.banner = command.banner;

    return this.communityRepo.update(command.communityId, data);
  }
}

export class ArchiveCommunityHandler {
  constructor(communityRepo) {
    this.communityRepo = communityRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");

    const allowed = CommunityPolicy.canArchive(
      { id: command.userId, role: "" },
      community.createdById || "",
    );
    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to archive this community",
      );

    const updated = await this.communityRepo.update(command.communityId, {
      archived: true,
    });
    await EventBus.publish(new CommunityArchivedEvent(command.communityId));
    return updated;
  }
}

export class DeleteCommunityHandler {
  constructor(communityRepo) {
    this.communityRepo = communityRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");

    const allowed = CommunityPolicy.canDelete(
      { id: command.userId, role: command.userRole },
      community.createdById || "",
    );
    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to delete this community",
      );

    // Run soft-delete updates in transaction: community soft-delete cascade to all its rooms!
    await prisma.$transaction(async (tx) => {
      await this.communityRepo.update(
        command.communityId,
        { deleted: true },
        tx,
      );
      const delegate = tx.room;
      await delegate.updateMany({
        where: { communityId: command.communityId, deleted: false },
        data: { deleted: true },
      });
    });

    await EventBus.publish(new CommunityDeletedEvent(command.communityId));
  }
}

export class TransferOwnershipHandler {
  constructor(communityRepo, membershipRepo) {
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");

    if (community.createdById !== command.userId) {
      throw new ForbiddenError(
        "Only the community owner can transfer ownership",
      );
    }

    const targetMembership = await this.membershipRepo.findMember(
      command.targetUserId,
      command.communityId,
    );
    if (!targetMembership || targetMembership.banned) {
      throw new BadRequestError(
        "Target user must be a member of the community",
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update Community creator link
      await this.communityRepo.update(
        command.communityId,
        { createdBy: { connect: { id: command.targetUserId } } },
        tx,
      );

      // 2. Promote target membership to owner
      await this.membershipRepo.update(
        targetMembership.id,
        { role: "owner" },
        tx,
      );

      // 3. Demote old owner membership to admin
      const oldMembership = await this.membershipRepo.findMember(
        command.userId,
        command.communityId,
        tx,
      );
      if (oldMembership) {
        await this.membershipRepo.update(
          oldMembership.id,
          { role: "admin" },
          tx,
        );
      }
    });
  }
}

export class JoinCommunityHandler {
  constructor(communityRepo, membershipRepo) {
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");
    if (community.archived)
      throw new BadRequestError("Community is archived and locked");

    const membership = await this.membershipRepo.findMember(
      command.userId,
      command.communityId,
    );
    if (membership) {
      if (membership.banned)
        throw new ForbiddenError("You are banned from joining this community");
      return; // Already joined
    }

    await this.membershipRepo.create({
      role: "member",
      user: { connect: { id: command.userId } },
      community: { connect: { id: command.communityId } },
    });

    await EventBus.publish(
      new MembershipCreatedEvent(command.userId, command.communityId),
    );
  }
}

export class LeaveCommunityHandler {
  constructor(communityRepo, membershipRepo) {
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted)
      throw new NotFoundError("Community not found");
    if (community.archived)
      throw new BadRequestError("Community is archived and locked");

    const membership = await this.membershipRepo.findMember(
      command.userId,
      command.communityId,
    );
    if (!membership) throw new NotFoundError("Membership not found");

    if (membership.role === "owner") {
      throw new BadRequestError(
        "The community owner cannot leave without transferring ownership first",
      );
    }

    await this.membershipRepo.delete(membership.id);
    await EventBus.publish(
      new MembershipRemovedEvent(command.userId, command.communityId),
    );
  }
}
