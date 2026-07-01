import { CommunityRepository } from '../../infrastructure/repository/CommunityRepository.js';
import { CommunityMembershipRepository } from '../../infrastructure/repository/CommunityMembershipRepository.js';
import { CommunityPolicy } from '../CommunityPolicy.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';
import { prisma } from '../../../../infrastructure/db/PrismaClient.js';

// --- Commands ---

export class CreateCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly category: string,
    public readonly imageUrl?: string,
    public readonly banner?: string
  ) {}
}

export class UpdateCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string,
    public readonly description?: string,
    public readonly imageUrl?: string,
    public readonly banner?: string
  ) {}
}

export class ArchiveCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {}
}

export class DeleteCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string,
    public readonly userRole: string
  ) {}
}

export class TransferOwnershipCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string,
    public readonly targetUserId: string
  ) {}
}

export class JoinCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {}
}

export class LeaveCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {}
}

// --- Domain Events ---

export class CommunityCreatedEvent implements IDomainEvent {
  readonly eventName = 'community.created';
  readonly occurredAt = new Date();
  constructor(public readonly communityId: string, public readonly ownerId: string) {}
}

export class CommunityArchivedEvent implements IDomainEvent {
  readonly eventName = 'community.archived';
  readonly occurredAt = new Date();
  constructor(public readonly communityId: string) {}
}

export class CommunityDeletedEvent implements IDomainEvent {
  readonly eventName = 'community.deleted';
  readonly occurredAt = new Date();
  constructor(public readonly communityId: string) {}
}

export class MembershipCreatedEvent implements IDomainEvent {
  readonly eventName = 'membership.created';
  readonly occurredAt = new Date();
  constructor(public readonly userId: string, public readonly communityId: string) {}
}

export class MembershipRemovedEvent implements IDomainEvent {
  readonly eventName = 'membership.removed';
  readonly occurredAt = new Date();
  constructor(public readonly userId: string, public readonly communityId: string) {}
}

// --- Handlers ---

export class CreateCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: CreateCommunityCommand): Promise<any> {
    const existing = await this.communityRepo.findByName(command.name);
    if (existing) {
      throw new BadRequestError(`Community name "${command.name}" is already taken`);
    }

    // Run creation inside database transaction to ensure creator membership is joined atomically
    return prisma.$transaction(async (tx) => {
      const community = await this.communityRepo.create({
        name: command.name,
        description: command.description,
        category: command.category,
        imageUrl: command.imageUrl,
        banner: command.banner,
        createdBy: { connect: { id: command.userId } }
      }, tx);

      // Creator automatically becomes owner
      await this.membershipRepo.create({
        role: 'owner',
        user: { connect: { id: command.userId } },
        community: { connect: { id: community.id } }
      }, tx);

      await EventBus.publish(new CommunityCreatedEvent(community.id, command.userId));
      return community;
    });
  }
}

export class UpdateCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: UpdateCommunityCommand): Promise<any> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');

    const membership = await this.membershipRepo.findMember(command.userId, command.communityId);
    
    // Policy Check
    const allowed = CommunityPolicy.canUpdate(
      { id: command.userId, role: '' }, // we don't have user site role here, default to empty
      community.createdById || '',
      membership || undefined
    );

    if (!allowed) throw new ForbiddenError('You do not have permission to edit this community');

    const data: any = {};
    if (command.description !== undefined) data.description = command.description;
    if (command.imageUrl !== undefined) data.imageUrl = command.imageUrl;
    if (command.banner !== undefined) data.banner = command.banner;

    return this.communityRepo.update(command.communityId, data);
  }
}

export class ArchiveCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository
  ) {}

  async execute(command: ArchiveCommunityCommand): Promise<any> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');

    const allowed = CommunityPolicy.canArchive({ id: command.userId, role: '' }, community.createdById || '');
    if (!allowed) throw new ForbiddenError('You do not have permission to archive this community');

    const updated = await this.communityRepo.update(command.communityId, { archived: true });
    await EventBus.publish(new CommunityArchivedEvent(command.communityId));
    return updated;
  }
}

export class DeleteCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository
  ) {}

  async execute(command: DeleteCommunityCommand): Promise<void> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');

    const allowed = CommunityPolicy.canDelete({ id: command.userId, role: command.userRole }, community.createdById || '');
    if (!allowed) throw new ForbiddenError('You do not have permission to delete this community');

    // Run soft-delete updates in transaction: community soft-delete cascade to all its rooms!
    await prisma.$transaction(async (tx) => {
      await this.communityRepo.update(command.communityId, { deleted: true }, tx);
      
      const delegate = tx.room;
      await delegate.updateMany({
        where: { communityId: command.communityId, deleted: false },
        data: { deleted: true }
      });
    });

    await EventBus.publish(new CommunityDeletedEvent(command.communityId));
  }
}

export class TransferOwnershipHandler {
  constructor(
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: TransferOwnershipCommand): Promise<void> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');

    if (community.createdById !== command.userId) {
      throw new ForbiddenError('Only the community owner can transfer ownership');
    }

    const targetMembership = await this.membershipRepo.findMember(command.targetUserId, command.communityId);
    if (!targetMembership || targetMembership.banned) {
      throw new BadRequestError('Target user must be a member of the community');
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update Community creator link
      await this.communityRepo.update(command.communityId, { createdBy: { connect: { id: command.targetUserId } } }, tx);

      // 2. Promote target membership to owner
      await this.membershipRepo.update(targetMembership.id, { role: 'owner' }, tx);

      // 3. Demote old owner membership to admin
      const oldMembership = await this.membershipRepo.findMember(command.userId, command.communityId, tx);
      if (oldMembership) {
        await this.membershipRepo.update(oldMembership.id, { role: 'admin' }, tx);
      }
    });
  }
}

export class JoinCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: JoinCommunityCommand): Promise<void> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');
    if (community.archived) throw new BadRequestError('Community is archived and locked');

    const membership = await this.membershipRepo.findMember(command.userId, command.communityId);
    if (membership) {
      if (membership.banned) throw new ForbiddenError('You are banned from joining this community');
      return; // Already joined
    }

    await this.membershipRepo.create({
      role: 'member',
      user: { connect: { id: command.userId } },
      community: { connect: { id: command.communityId } }
    });

    await EventBus.publish(new MembershipCreatedEvent(command.userId, command.communityId));
  }
}

export class LeaveCommunityHandler {
  constructor(
    private readonly communityRepo: CommunityRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: LeaveCommunityCommand): Promise<void> {
    const community = await this.communityRepo.findById(command.communityId);
    if (!community || community.deleted) throw new NotFoundError('Community not found');
    if (community.archived) throw new BadRequestError('Community is archived and locked');

    const membership = await this.membershipRepo.findMember(command.userId, command.communityId);
    if (!membership) throw new NotFoundError('Membership not found');

    if (membership.role === 'owner') {
      throw new BadRequestError('The community owner cannot leave without transferring ownership first');
    }

    await this.membershipRepo.delete(membership.id);
    await EventBus.publish(new MembershipRemovedEvent(command.userId, command.communityId));
  }
}
