import { ReportRepository } from '../../infrastructure/repository/ReportRepository.js';
import { ModerationActionRepository } from '../../infrastructure/repository/ModerationActionRepository.js';
import { AppealRepository } from '../../infrastructure/repository/AppealRepository.js';
import { AuditLogRepository } from '../../infrastructure/repository/AuditLogRepository.js';
import { ModerationPolicy } from '../ModerationPolicy.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';
import { io } from '../../../../infrastructure/socket/SocketServer.js';
import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { CommunityMembershipRepository } from '../../../community/infrastructure/repository/CommunityMembershipRepository.js';

// --- Commands ---

export class CreateReportCommand {
  constructor(
    public readonly reporterId: string,
    public readonly reason: string,
    public readonly description: string,
    public readonly reportedUserId?: string,
    public readonly messageId?: string,
    public readonly roomId?: string,
    public readonly reportedCommunityId?: string
  ) {}
}

export class AssignReportCommand {
  constructor(
    public readonly userId: string,
    public readonly userRole: string,
    public readonly reportId: string,
    public readonly moderatorId: string
  ) {}
}

export class ResolveReportCommand {
  constructor(
    public readonly userId: string,
    public readonly userRole: string,
    public readonly reportId: string,
    public readonly resolutionReason: string
  ) {}
}

export class ExecuteModerationActionCommand {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: string,
    public readonly targetUserId: string,
    public readonly type: 'warn' | 'mute' | 'suspend' | 'ban',
    public readonly reason: string,
    public readonly expiresAt?: Date,
    public readonly communityId?: string
  ) {}
}

export class SubmitAppealCommand {
  constructor(
    public readonly userId: string,
    public readonly actionId: string,
    public readonly reason: string
  ) {}
}

export class ResolveAppealCommand {
  constructor(
    public readonly userId: string,
    public readonly userRole: string,
    public readonly appealId: string,
    public readonly status: 'approved' | 'rejected',
    public readonly resolution: string
  ) {}
}

// --- Domain Events ---

export class ReportCreatedEvent implements IDomainEvent {
  readonly eventName = 'report.created';
  readonly occurredAt = new Date();
  constructor(public readonly reportId: string) {}
}

export class ReportResolvedEvent implements IDomainEvent {
  readonly eventName = 'report.resolved';
  readonly occurredAt = new Date();
  constructor(public readonly reportId: string, public readonly resolverId: string) {}
}

export class ModerationActionExecutedEvent implements IDomainEvent {
  readonly eventName = 'moderation.action.executed';
  readonly occurredAt = new Date();
  constructor(public readonly actionId: string, public readonly type: string) {}
}

export class AppealResolvedEvent implements IDomainEvent {
  readonly eventName = 'appeal.resolved';
  readonly occurredAt = new Date();
  constructor(public readonly appealId: string, public readonly status: string) {}
}

// --- Handlers ---

export class CreateReportHandler {
  constructor(
    private readonly reportRepo: ReportRepository
  ) {}

  async execute(command: CreateReportCommand): Promise<any> {
    const report = await this.reportRepo.create({
      reason: command.reason,
      description: command.description,
      reporter: { connect: { id: command.reporterId } },
      ...(command.reportedUserId ? { reportedUser: { connect: { id: command.reportedUserId } } } : {}),
      ...(command.messageId ? { message: { connect: { id: command.messageId } } } : {}),
      ...(command.roomId ? { room: { connect: { id: command.roomId } } } : {}),
      ...(command.reportedCommunityId ? { reportedCommunity: { connect: { id: command.reportedCommunityId } } } : {})
    });

    await EventBus.publish(new ReportCreatedEvent(report.id));

    // Realtime broadcast to moderators dashboard channel
    if (io) {
      io.to('moderators').emit('report.created', { success: true, data: report });
    }

    return report;
  }
}

export class AssignReportHandler {
  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly auditRepo: AuditLogRepository
  ) {}

  async execute(command: AssignReportCommand): Promise<any> {
    const report = await this.reportRepo.findById(command.reportId);
    if (!report) throw new NotFoundError('Report not found');

    const allowed = ModerationPolicy.canManageReport({ id: command.userId, role: command.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to assign reports');

    return prisma.$transaction(async (tx) => {
      const updated = await this.reportRepo.update(command.reportId, {
        status: 'assigned',
        assigned: { connect: { id: command.moderatorId } }
      }, tx);

      // Log to immutable Audit trail
      await this.auditRepo.create({
        action: 'report.assigned',
        targetId: command.reportId,
        targetType: 'Report',
        details: `Report ${command.reportId} assigned to Moderator ${command.moderatorId}`,
        actor: { connect: { id: command.userId } }
      }, tx);

      if (io) {
        io.to('moderators').emit('report.assigned', { success: true, data: updated });
      }

      return updated;
    });
  }
}

export class ResolveReportHandler {
  constructor(
    private readonly reportRepo: ReportRepository,
    private readonly auditRepo: AuditLogRepository
  ) {}

  async execute(command: ResolveReportCommand): Promise<any> {
    const report = await this.reportRepo.findById(command.reportId);
    if (!report) throw new NotFoundError('Report not found');

    const allowed = ModerationPolicy.canManageReport({ id: command.userId, role: command.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to resolve reports');

    return prisma.$transaction(async (tx) => {
      const updated = await this.reportRepo.update(command.reportId, {
        status: 'resolved',
        resolutionReason: command.resolutionReason,
        resolvedAt: new Date(),
        resolvedBy: { connect: { id: command.userId } }
      }, tx);

      await this.auditRepo.create({
        action: 'report.resolved',
        targetId: command.reportId,
        targetType: 'Report',
        details: `Report ${command.reportId} resolved with reason: ${command.resolutionReason}`,
        actor: { connect: { id: command.userId } }
      }, tx);

      await EventBus.publish(new ReportResolvedEvent(command.reportId, command.userId));

      if (io) {
        io.to('moderators').emit('report.resolved', { success: true, data: updated });
      }

      return updated;
    });
  }
}

export class ExecuteModerationActionHandler {
  constructor(
    private readonly actionRepo: ModerationActionRepository,
    private readonly auditRepo: AuditLogRepository,
    private readonly membershipRepo: CommunityMembershipRepository
  ) {}

  async execute(command: ExecuteModerationActionCommand): Promise<any> {
    // 1. Policy Authorization
    let allowed = false;
    if (command.communityId) {
      const membership = await this.membershipRepo.findMember(command.actorId, command.communityId);
      allowed = ModerationPolicy.canExecuteCommunityAction(
        { id: command.actorId, role: command.actorRole },
        membership || undefined
      );
    } else {
      allowed = ModerationPolicy.canExecutePlatformAction({ id: command.actorId, role: command.actorRole });
    }

    if (!allowed) throw new ForbiddenError('You do not have permission to execute this moderation action');

    return prisma.$transaction(async (tx) => {
      const action = await this.actionRepo.create({
        type: command.type,
        reason: command.reason,
        expiresAt: command.expiresAt,
        active: true,
        user: { connect: { id: command.targetUserId } },
        actor: { connect: { id: command.actorId } },
        ...(command.communityId ? { community: { connect: { id: command.communityId } } } : {})
      }, tx);

      // If platform ban/suspension, update user status/access in User table
      if (!command.communityId && (command.type === 'ban' || command.type === 'suspend')) {
        // Mark target user as banned or status deactivated
        await tx.user.update({
          where: { id: command.targetUserId },
          data: { status: 'offline' } // locks out active sessions
        });
      }

      // Log to immutable Audit trail
      await this.auditRepo.create({
        action: `user.${command.type}`,
        targetId: command.targetUserId,
        targetType: 'User',
        details: `Executed ${command.type} action on User ${command.targetUserId} for reason: ${command.reason}`,
        actor: { connect: { id: command.actorId } }
      }, tx);

      await EventBus.publish(new ModerationActionExecutedEvent(action.id, command.type));

      if (io) {
        io.to('moderators').emit('moderation.action.executed', { success: true, data: action });
      }

      return action;
    });
  }
}

export class SubmitAppealHandler {
  constructor(
    private readonly appealRepo: AppealRepository
  ) {}

  async execute(command: SubmitAppealCommand): Promise<any> {
    return this.appealRepo.create({
      reason: command.reason,
      status: 'pending',
      user: { connect: { id: command.userId } },
      action: { connect: { id: command.actionId } }
    });
  }
}

export class ResolveAppealHandler {
  constructor(
    private readonly appealRepo: AppealRepository,
    private readonly actionRepo: ModerationActionRepository,
    private readonly auditRepo: AuditLogRepository
  ) {}

  async execute(command: ResolveAppealCommand): Promise<any> {
    const appeal = await this.appealRepo.findById(command.appealId);
    if (!appeal) throw new NotFoundError('Appeal not found');

    const allowed = ModerationPolicy.canResolveAppeal({ id: command.userId, role: command.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to resolve appeals');

    return prisma.$transaction(async (tx) => {
      const updatedAppeal = await this.appealRepo.update(command.appealId, {
        status: command.status,
        resolution: command.resolution,
        resolvedBy: { connect: { id: command.userId } }
      }, tx);

      // If appeal is approved, lift/deactivate the associated ModerationAction
      if (command.status === 'approved') {
        await this.actionRepo.update(appeal.actionId, { active: false }, tx);
      }

      await this.auditRepo.create({
        action: `appeal.${command.status}`,
        targetId: command.appealId,
        targetType: 'Appeal',
        details: `Resolved Appeal ${command.appealId} as ${command.status}: ${command.resolution}`,
        actor: { connect: { id: command.userId } }
      }, tx);

      await EventBus.publish(new AppealResolvedEvent(command.appealId, command.status));

      return updatedAppeal;
    });
  }
}

export class RemoveContentCommand {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: string,
    public readonly contentType: 'message' | 'room' | 'community',
    public readonly contentId: string,
    public readonly reason: string
  ) {}
}

export class RestoreContentCommand {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: string,
    public readonly contentType: 'message' | 'room' | 'community',
    public readonly contentId: string,
    public readonly reason: string
  ) {}
}

export class ContentRemovedEvent implements IDomainEvent {
  readonly eventName = 'content.removed';
  readonly occurredAt = new Date();
  constructor(
    public readonly contentId: string,
    public readonly contentType: string,
    public readonly reason: string,
    public readonly actorId: string
  ) {}
}

export class ContentRestoredEvent implements IDomainEvent {
  readonly eventName = 'content.restored';
  readonly occurredAt = new Date();
  constructor(
    public readonly contentId: string,
    public readonly contentType: string,
    public readonly reason: string,
    public readonly actorId: string
  ) {}
}

export class RemoveContentHandler {
  constructor(
    private readonly messageRepo: any,
    private readonly roomRepo: any,
    private readonly communityRepo: any,
    private readonly membershipRepo: any,
    private readonly auditRepo: AuditLogRepository
  ) {}

  async execute(command: RemoveContentCommand): Promise<void> {
    let communityId: string | undefined = undefined;

    if (command.contentType === 'message') {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError('Message not found');
      if (message.deleted) throw new BadRequestError('Message is already removed');

      const room = await this.roomRepo.findById(message.roomId);
      if (room && room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === 'room') {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError('Room not found');
      if (room.deleted) throw new BadRequestError('Room is already removed');
      if (room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === 'community') {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError('Community not found');
      if (community.deleted) throw new BadRequestError('Community is already removed');
    }

    let allowed = false;
    if (communityId) {
      const membership = await this.membershipRepo.findMember(command.actorId, communityId);
      allowed = ModerationPolicy.canExecuteCommunityAction(
        { id: command.actorId, role: command.actorRole },
        membership || undefined
      );
    } else {
      allowed = ModerationPolicy.canExecutePlatformAction({ id: command.actorId, role: command.actorRole });
    }

    if (!allowed) throw new ForbiddenError('You do not have permission to moderate this content');

    await prisma.$transaction(async (tx) => {
      if (command.contentType === 'message') {
        await this.messageRepo.update(command.contentId, { deleted: true }, tx);
      } else if (command.contentType === 'room') {
        await this.roomRepo.update(command.contentId, { deleted: true }, tx);
      } else if (command.contentType === 'community') {
        await this.communityRepo.update(command.contentId, { deleted: true }, tx);
      }

      await this.auditRepo.create({
        action: `content.removed`,
        targetId: command.contentId,
        targetType: command.contentType,
        details: `Removed ${command.contentType} ${command.contentId} for reason: ${command.reason}`,
        actor: { connect: { id: command.actorId } }
      }, tx);

      await EventBus.publish(new ContentRemovedEvent(command.contentId, command.contentType, command.reason, command.actorId));

      if (io) {
        io.to('moderators').emit('content.removed', {
          success: true,
          data: { contentId: command.contentId, contentType: command.contentType, reason: command.reason }
        });
      }
    });
  }
}

export class RestoreContentHandler {
  constructor(
    private readonly messageRepo: any,
    private readonly roomRepo: any,
    private readonly communityRepo: any,
    private readonly membershipRepo: any,
    private readonly auditRepo: AuditLogRepository
  ) {}

  async execute(command: RestoreContentCommand): Promise<void> {
    let communityId: string | undefined = undefined;

    if (command.contentType === 'message') {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError('Message not found');
      if (!message.deleted) throw new BadRequestError('Message is not removed');

      const room = await this.roomRepo.findById(message.roomId);
      if (room && room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === 'room') {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError('Room not found');
      if (!room.deleted) throw new BadRequestError('Room is not removed');
      if (room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === 'community') {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError('Community not found');
      if (!community.deleted) throw new BadRequestError('Community is not removed');
    }

    let allowed = false;
    if (communityId) {
      const membership = await this.membershipRepo.findMember(command.actorId, communityId);
      allowed = ModerationPolicy.canExecuteCommunityAction(
        { id: command.actorId, role: command.actorRole },
        membership || undefined
      );
    } else {
      allowed = ModerationPolicy.canExecutePlatformAction({ id: command.actorId, role: command.actorRole });
    }

    if (!allowed) throw new ForbiddenError('You do not have permission to restore this content');

    await prisma.$transaction(async (tx) => {
      if (command.contentType === 'message') {
        await this.messageRepo.update(command.contentId, { deleted: false }, tx);
      } else if (command.contentType === 'room') {
        await this.roomRepo.update(command.contentId, { deleted: false }, tx);
      } else if (command.contentType === 'community') {
        await this.communityRepo.update(command.contentId, { deleted: false }, tx);
      }

      await this.auditRepo.create({
        action: `content.restored`,
        targetId: command.contentId,
        targetType: command.contentType,
        details: `Restored ${command.contentType} ${command.contentId} for reason: ${command.reason}`,
        actor: { connect: { id: command.actorId } }
      }, tx);

      await EventBus.publish(new ContentRestoredEvent(command.contentId, command.contentType, command.reason, command.actorId));

      if (io) {
        io.to('moderators').emit('content.restored', {
          success: true,
          data: { contentId: command.contentId, contentType: command.contentType, reason: command.reason }
        });
      }
    });
  }
}
