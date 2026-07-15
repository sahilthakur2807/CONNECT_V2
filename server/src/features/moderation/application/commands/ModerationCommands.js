import { ModerationPolicy } from "../ModerationPolicy.js";
import { CommunityPolicy } from "../../../community/application/CommunityPolicy.js";
import { RoomPolicy } from "../../../room/application/RoomPolicy.js";
import { MessagePolicy } from "../../../message/application/MessagePolicy.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { io, activeUserConnections } from "../../../../infrastructure/socket/SocketServer.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Socket Broadcast Helper ---
async function broadcastModerationEvent(eventName, payload, reportId, communityId, roomId) {
  if (!io) return;

  // Always emit to global platform moderators
  io.to("moderators").emit(eventName, payload);

  // If communityId is provided
  if (communityId) {
    io.to(`community_moderators_${communityId}`).emit(eventName, payload);
  }

  // If roomId is provided
  if (roomId) {
    io.to(`room_moderators_${roomId}`).emit(eventName, payload);
    // Find room communityId if not provided
    if (!communityId && prisma.room?.findUnique) {
      try {
        const roomObj = await prisma.room.findUnique({
          where: { id: roomId },
          select: { communityId: true }
        });
        if (roomObj?.communityId) {
          io.to(`community_moderators_${roomObj.communityId}`).emit(eventName, payload);
        }
      } catch (err) {
        console.error("Failed to lookup room community during socket broadcast:", err);
      }
    }
  }

  // If reportId is provided, we can look up its communityId/roomId if they weren't passed
  if (reportId && !communityId && !roomId && prisma.report?.findUnique) {
    try {
      const rep = await prisma.report.findUnique({
        where: { id: reportId },
        select: { reportedCommunityId: true, roomId: true }
      });
      if (rep) {
        if (rep.reportedCommunityId) {
          io.to(`community_moderators_${rep.reportedCommunityId}`).emit(eventName, payload);
        }
        if (rep.roomId) {
          io.to(`room_moderators_${rep.roomId}`).emit(eventName, payload);
          if (prisma.room?.findUnique) {
            const roomObj = await prisma.room.findUnique({
              where: { id: rep.roomId },
              select: { communityId: true }
            });
            if (roomObj?.communityId && roomObj.communityId !== rep.reportedCommunityId) {
              io.to(`community_moderators_${roomObj.communityId}`).emit(eventName, payload);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to lookup report context during socket broadcast:", err);
    }
  }
}

// --- Commands ---

export class CreateReportCommand {
  constructor(
    reporterId,
    reason,
    description,
    reportedUserId,
    messageId,
    roomId,
    reportedCommunityId,
  ) {
    this.reporterId = reporterId;
    this.reason = reason;
    this.description = description;
    this.reportedUserId = reportedUserId;
    this.messageId = messageId;
    this.roomId = roomId;
    this.reportedCommunityId = reportedCommunityId;
  }
}

export class AssignReportCommand {
  constructor(userId, userRole, reportId, moderatorId) {
    this.userId = userId;
    this.userRole = userRole;
    this.reportId = reportId;
    this.moderatorId = moderatorId;
  }
}

export class ResolveReportCommand {
  constructor(userId, userRole, reportId, resolutionReason) {
    this.userId = userId;
    this.userRole = userRole;
    this.reportId = reportId;
    this.resolutionReason = resolutionReason;
  }
}

export class ExecuteModerationActionCommand {
  constructor(
    actorId,
    actorRole,
    targetUserId,
    type,
    reason,
    expiresAt,
    communityId,
    roomId,
  ) {
    this.actorId = actorId;
    this.actorRole = actorRole;
    this.targetUserId = targetUserId;
    this.type = type;
    this.reason = reason;
    this.expiresAt = expiresAt;
    this.communityId = communityId;
    this.roomId = roomId;
  }
}

export class SubmitAppealCommand {
  constructor(userId, actionId, reason) {
    this.userId = userId;
    this.actionId = actionId;
    this.reason = reason;
  }
}

export class ResolveAppealCommand {
  constructor(userId, userRole, appealId, status, resolution) {
    this.userId = userId;
    this.userRole = userRole;
    this.appealId = appealId;
    this.status = status;
    this.resolution = resolution;
  }
}

// --- Domain Events ---

export class ReportCreatedEvent {
  eventName = "report.created";
  occurredAt = new Date();
  constructor(reportId) {
    this.reportId = reportId;
  }
}

export class ReportResolvedEvent {
  eventName = "report.resolved";
  occurredAt = new Date();
  constructor(reportId, resolverId) {
    this.reportId = reportId;
    this.resolverId = resolverId;
  }
}

export class ReportEscalatedEvent {
  eventName = "report.escalated";
  occurredAt = new Date();
  constructor(reportId) {
    this.reportId = reportId;
  }
}

export class ModerationActionExecutedEvent {
  eventName = "moderation.action.executed";
  occurredAt = new Date();
  constructor(actionId, type) {
    this.actionId = actionId;
    this.type = type;
  }
}

export class AppealResolvedEvent {
  eventName = "appeal.resolved";
  occurredAt = new Date();
  constructor(appealId, status) {
    this.appealId = appealId;
    this.status = status;
  }
}

// --- Handlers ---

export class CreateReportHandler {
  constructor(reportRepo) {
    this.reportRepo = reportRepo;
  }

  async execute(command) {
    let reportedUserRole = null;
    let finalReportedUserId = command.reportedUserId;
    let finalRoomId = command.roomId;
    let finalReportedCommunityId = command.reportedCommunityId;

    if (command.messageId) {
      const message = await prisma.message.findUnique({
        where: { id: command.messageId },
        include: {
          user: { select: { id: true, role: true } },
          room: { select: { id: true, communityId: true, createdById: true } }
        }
      });
      if (message) {
        finalReportedUserId = message.userId;
        reportedUserRole = message.user.role;
        finalRoomId = message.roomId;
        finalReportedCommunityId = message.room.communityId;
      }
    } else if (finalReportedUserId) {
      const userObj = await prisma.user.findUnique({
        where: { id: finalReportedUserId },
        select: { role: true }
      });
      if (userObj) {
        reportedUserRole = userObj.role;
      }
    }

    if (reportedUserRole && ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(reportedUserRole.toUpperCase())) {
      let roomObj = null;
      if (finalRoomId) {
        roomObj = await prisma.room.findUnique({
          where: { id: finalRoomId },
          select: { title: true, createdById: true, communityId: true }
        });
      }

      const reportedUser = await prisma.user.findUnique({
        where: { id: finalReportedUserId },
        select: { username: true }
      });

      const report = await this.reportRepo.create({
        reason: command.reason,
        description: command.description,
        status: "resolved",
        resolutionReason: "System: Reported user is staff. Automatically resolved.",
        resolvedAt: new Date(),
        reporter: { connect: { id: command.reporterId } },
        ...(finalReportedUserId ? { reportedUser: { connect: { id: finalReportedUserId } } } : {}),
        ...(command.messageId ? { message: { connect: { id: command.messageId } } } : {}),
        ...(finalRoomId ? { room: { connect: { id: finalRoomId } } } : {}),
        ...(finalReportedCommunityId ? { reportedCommunity: { connect: { id: finalReportedCommunityId } } } : {}),
      });

      const platformMods = await prisma.user.findMany({
        where: {
          role: "PLATFORM_MOD",
          isDeleted: false
        },
        select: { id: true }
      });
      const platformModIds = new Set(platformMods.map(m => m.id));

      const owners = new Set();
      if (roomObj && roomObj.createdById) {
        owners.add(roomObj.createdById);
      }

      const recipientIds = new Set();
      platformModIds.forEach(id => recipientIds.add(id));
      owners.forEach(id => recipientIds.add(id));

      recipientIds.delete(command.reporterId);

      if (finalReportedUserId) {
        if (!platformModIds.has(finalReportedUserId) && !owners.has(finalReportedUserId)) {
          recipientIds.delete(finalReportedUserId);
        }
      }

      for (const recipientId of recipientIds) {
        const staffReportedNotif = await prisma.notification.create({
          data: {
            type: "staff_reported",
            title: "Staff Member Reported",
            body: `Staff member @${reportedUser?.username || "Staff"} was reported in room "${roomObj?.title || "Discussion Room"}". Reason: ${command.reason}`,
            roomId: finalRoomId || null,
            referenceId: report.id,
            user: { connect: { id: recipientId } },
            trigger: { connect: { id: command.reporterId } }
          }
        });
        if (io) {
          io.to(recipientId).emit("notification.created", {
            success: true,
            data: staffReportedNotif
          });
        }
      }

      await EventBus.publish(new ReportCreatedEvent(report.id));

      if (io) {
        await broadcastModerationEvent("report.created", {
          success: true,
          data: report,
        }, null, report.reportedCommunityId, report.roomId);
      }

      return report;
    }

    // Default reporting path for standard users
    const report = await this.reportRepo.create({
      reason: command.reason,
      description: command.description,
      reporter: { connect: { id: command.reporterId } },
      ...(command.reportedUserId
        ? { reportedUser: { connect: { id: command.reportedUserId } } }
        : {}),
      ...(command.messageId
        ? { message: { connect: { id: command.messageId } } }
        : {}),
      ...(command.roomId ? { room: { connect: { id: command.roomId } } } : {}),
      ...(command.reportedCommunityId
        ? {
            reportedCommunity: { connect: { id: command.reportedCommunityId } },
          }
        : {}),
    });

    await EventBus.publish(new ReportCreatedEvent(report.id));

    if (io) {
      await broadcastModerationEvent("report.created", {
        success: true,
        data: report,
      }, null, report.reportedCommunityId, report.roomId);
    }

    return report;
  }
}

export class AssignReportHandler {
  constructor(reportRepo, auditRepo) {
    this.reportRepo = reportRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    const report = await this.reportRepo.findById(command.reportId);
    if (!report) throw new NotFoundError("Report not found");

    const allowed = ModerationPolicy.canManageReport({
      id: command.userId,
      role: command.userRole,
    });
    if (!allowed)
      throw new ForbiddenError("You do not have permission to assign reports");

    return prisma.$transaction(async (tx) => {
      const updated = await this.reportRepo.update(
        command.reportId,
        {
          status: "assigned",
          assigned: { connect: { id: command.moderatorId } },
        },
        tx,
      );

      // Log to immutable Audit trail
      await this.auditRepo.create(
        {
          action: "report.assigned",
          targetId: command.reportId,
          targetType: "Report",
          details: `Report ${command.reportId} assigned to Moderator ${command.moderatorId}`,
          actor: { connect: { id: command.userId } },
        },
        tx,
      );

      if (io) {
        await broadcastModerationEvent("report.assigned", {
          success: true,
          data: updated,
        }, command.reportId);
      }

      return updated;
    });
  }
}

export class ResolveReportHandler {
  constructor(reportRepo, auditRepo) {
    this.reportRepo = reportRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    const report = await this.reportRepo.findById(command.reportId);
    if (!report) throw new NotFoundError("Report not found");

    const actorRole = command.userRole?.toUpperCase();
    const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(actorRole);

    let allowed = isPlatformStaff;

    if (!allowed && report.roomId) {
      const room = await prisma.room.findUnique({
        where: { id: report.roomId },
        select: { createdById: true, communityId: true }
      });
      if (room && room.createdById === command.userId) {
        allowed = true;
      }
      
      // Also check community membership of the room's community
      if (!allowed && room && room.communityId) {
        const membership = await prisma.communityMember.findUnique({
          where: {
            userId_communityId: { userId: command.userId, communityId: room.communityId }
          }
        });
        if (membership && !membership.banned && ["OWNER", "ADMIN", "MODERATOR"].includes(membership.role?.toUpperCase())) {
          allowed = true;
        }
      }
    }

    if (!allowed && report.reportedCommunityId) {
      const membership = await prisma.communityMember.findUnique({
        where: {
          userId_communityId: { userId: command.userId, communityId: report.reportedCommunityId }
        }
      });
      if (membership && !membership.banned && ["OWNER", "ADMIN", "MODERATOR"].includes(membership.role?.toUpperCase())) {
        allowed = true;
      }
    }

    if (!allowed)
      throw new ForbiddenError("You do not have permission to resolve reports");

    return prisma.$transaction(async (tx) => {
      const updated = await this.reportRepo.update(
        command.reportId,
        {
          status: "resolved",
          resolutionReason: command.resolutionReason,
          resolvedAt: new Date(),
          resolvedBy: { connect: { id: command.userId } },
        },
        tx,
      );

      await this.auditRepo.create(
        {
          action: "report.resolved",
          targetId: command.reportId,
          targetType: "Report",
          details: `Report ${command.reportId} resolved with reason: ${command.resolutionReason}`,
          actor: { connect: { id: command.userId } },
        },
        tx,
      );

      await EventBus.publish(
        new ReportResolvedEvent(command.reportId, command.userId),
      );

      if (io) {
        await broadcastModerationEvent("report.resolved", {
          success: true,
          data: updated,
        }, command.reportId);
      }

      return updated;
    });
  }
}

export class ExecuteModerationActionHandler {
  constructor(actionRepo, auditRepo, membershipRepo) {
    this.actionRepo = actionRepo;
    this.auditRepo = auditRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(command) {
    const targetUser = await prisma.user.findUnique({
      where: { id: command.targetUserId },
      select: { role: true }
    });
    if (!targetUser) throw new NotFoundError("Target user not found");

    const hierarchyAllowed = ModerationPolicy.canModerateUser(command.actorRole, targetUser.role);
    if (!hierarchyAllowed) {
      throw new ForbiddenError("You do not have permission to moderate a user with this role hierarchy level");
    }

    let allowed = false;
    if (command.communityId) {
      const membership = await this.membershipRepo.findMember(
        command.actorId,
        command.communityId,
      );
      allowed = ModerationPolicy.canExecuteCommunityAction(
        { id: command.actorId, role: command.actorRole },
        membership || undefined,
      );
    } else {
      allowed = ModerationPolicy.canExecutePlatformModeration(
        { id: command.actorId, role: command.actorRole },
        command.type,
        command.expiresAt,
      );
    }

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to execute this moderation action",
      );

    return prisma.$transaction(async (tx) => {
      const action = await this.actionRepo.create(
        {
          type: command.type,
          reason: command.reason,
          expiresAt: command.expiresAt,
          active: true,
          user: { connect: { id: command.targetUserId } },
          actor: { connect: { id: command.actorId } },
          ...(command.communityId
            ? { community: { connect: { id: command.communityId } } }
            : {}),
          ...(command.roomId
            ? { room: { connect: { id: command.roomId } } }
            : {}),
        },
        tx,
      );

      // If platform ban/suspension, update user status/access in User table
      if (
        !command.communityId &&
        (command.type === "ban" || command.type === "suspend")
      ) {
        // Mark target user as banned or status deactivated
        await tx.user.update({
          where: { id: command.targetUserId },
          data: { status: "offline" }, // locks out active sessions
        });

        // Immediately disconnect all active sockets of the banned/suspended user
        if (io && activeUserConnections) {
          const socketIds = activeUserConnections.get(command.targetUserId);
          if (socketIds) {
            for (const socketId of socketIds) {
              const socket = io.sockets.sockets.get(socketId);
              if (socket) {
                socket.disconnect(true);
              }
            }
          }
        }
      }

      // Log to immutable Audit trail
      await this.auditRepo.create(
        {
          action: `user.${command.type}`,
          targetId: command.targetUserId,
          targetType: "User",
          details: `Executed ${command.type} action on User ${command.targetUserId} for reason: ${command.reason}`,
          actor: { connect: { id: command.actorId } },
        },
        tx,
      );

      await EventBus.publish(
        new ModerationActionExecutedEvent(action.id, command.type),
      );

      if (io) {
        await broadcastModerationEvent("moderation.action.executed", {
          success: true,
          data: action,
        }, null, command.communityId);
      }

      return action;
    });
  }
}

export class SubmitAppealHandler {
  constructor(appealRepo) {
    this.appealRepo = appealRepo;
  }

  async execute(command) {
    let finalActionId = command.actionId;
    if (finalActionId === "platform-restriction" || !finalActionId) {
      const latestAction = await prisma.moderationAction.findFirst({
        where: {
          userId: command.userId,
          active: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });
      if (latestAction) {
        finalActionId = latestAction.id;
      } else {
        const anyAction = await prisma.moderationAction.findFirst({
          where: { userId: command.userId },
          orderBy: { createdAt: "desc" }
        });
        if (anyAction) {
          finalActionId = anyAction.id;
        } else {
          const systemAction = await prisma.moderationAction.create({
            data: {
              type: "ban",
              reason: "System restriction active",
              active: true,
              user: { connect: { id: command.userId } },
              actor: { connect: { id: command.userId } }
            }
          });
          finalActionId = systemAction.id;
        }
      }
    } else {
      const exists = await prisma.moderationAction.findUnique({
        where: { id: finalActionId }
      });
      if (!exists) {
        const anyAction = await prisma.moderationAction.findFirst({
          where: { userId: command.userId },
          orderBy: { createdAt: "desc" }
        });
        if (anyAction) {
          finalActionId = anyAction.id;
        } else {
          const systemAction = await prisma.moderationAction.create({
            data: {
              type: "ban",
              reason: "System restriction active",
              active: true,
              user: { connect: { id: command.userId } },
              actor: { connect: { id: command.userId } }
            }
          });
          finalActionId = systemAction.id;
        }
      }
    }

    const appeal = await this.appealRepo.create({
      reason: command.reason,
      status: "pending",
      user: { connect: { id: command.userId } },
      action: { connect: { id: finalActionId } },
    });

    await EventBus.publish(new AppealSubmittedEvent(appeal.id));

    return appeal;
  }
}

export class AppealSubmittedEvent {
  eventName = "appeal.submitted";
  occurredAt = new Date();
  constructor(appealId) {
    this.appealId = appealId;
  }
}

export class ResolveAppealHandler {
  constructor(appealRepo, actionRepo, auditRepo) {
    this.appealRepo = appealRepo;
    this.actionRepo = actionRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    const appeal = await this.appealRepo.findById(command.appealId);
    if (!appeal) throw new NotFoundError("Appeal not found");

    const allowed = ModerationPolicy.canResolveAppeal({
      id: command.userId,
      role: command.userRole,
    });
    if (!allowed)
      throw new ForbiddenError("You do not have permission to resolve appeals");

    return prisma.$transaction(async (tx) => {
      const updatedAppeal = await this.appealRepo.update(
        command.appealId,
        {
          status: command.status,
          resolution: command.resolution,
          resolvedBy: { connect: { id: command.userId } },
        },
        tx,
      );

      // If appeal is approved, lift/deactivate the associated ModerationAction
      if (command.status === "approved") {
        await this.actionRepo.update(appeal.actionId, { active: false }, tx);
      }

      await this.auditRepo.create(
        {
          action: `appeal.${command.status}`,
          targetId: command.appealId,
          targetType: "Appeal",
          details: `Resolved Appeal ${command.appealId} as ${command.status}: ${command.resolution}`,
          actor: { connect: { id: command.userId } },
        },
        tx,
      );

      await EventBus.publish(
        new AppealResolvedEvent(command.appealId, command.status),
      );

      return updatedAppeal;
    });
  }
}

export class RemoveContentCommand {
  constructor(actorId, actorRole, contentType, contentId, reason) {
    this.actorId = actorId;
    this.actorRole = actorRole;
    this.contentType = contentType;
    this.contentId = contentId;
    this.reason = reason;
  }
}

export class RestoreContentCommand {
  constructor(actorId, actorRole, contentType, contentId, reason) {
    this.actorId = actorId;
    this.actorRole = actorRole;
    this.contentType = contentType;
    this.contentId = contentId;
    this.reason = reason;
  }
}

export class ContentRemovedEvent {
  eventName = "content.removed";
  occurredAt = new Date();
  constructor(contentId, contentType, reason, actorId) {
    this.contentId = contentId;
    this.contentType = contentType;
    this.reason = reason;
    this.actorId = actorId;
  }
}

export class ContentRestoredEvent {
  eventName = "content.restored";
  occurredAt = new Date();
  constructor(contentId, contentType, reason, actorId) {
    this.contentId = contentId;
    this.contentType = contentType;
    this.reason = reason;
    this.actorId = actorId;
  }
}

export class RemoveContentHandler {
  constructor(messageRepo, roomRepo, communityRepo, membershipRepo, auditRepo) {
    this.messageRepo = messageRepo;
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    let communityId = undefined;

    if (command.contentType === "message") {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError("Message not found");
      if (message.deleted)
        throw new BadRequestError("Message is already removed");

      const room = await this.roomRepo.findById(message.roomId);
      if (room && room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === "room") {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError("Room not found");
      if (room.deleted) throw new BadRequestError("Room is already removed");
      if (room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === "community") {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError("Community not found");
      if (community.deleted)
        throw new BadRequestError("Community is already removed");
    }

    let allowed = false;

    if (command.contentType === "message") {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError("Message not found");
      const room = await this.roomRepo.findById(message.roomId);
      
      let actorCommunityRole = null;
      if (room?.communityId) {
        const membership = await this.membershipRepo.findMember(
          command.actorId,
          room.communityId,
        );
        if (membership && !membership.banned) {
          actorCommunityRole = membership.role;
        }
      }

      let actorRoomStatus = null;
      if (message.roomId) {
        const roomMember = await prisma.roomMember.findUnique({
          where: {
            userId_roomId: {
              userId: command.actorId,
              roomId: message.roomId,
            },
          },
        });
        if (roomMember) {
          actorRoomStatus = roomMember.status;
        }
      }

      allowed = MessagePolicy.canDelete(
        { id: command.actorId, role: command.actorRole },
        message.userId,
        actorCommunityRole,
        actorRoomStatus,
      );
    } else if (command.contentType === "room") {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError("Room not found");
      
      let communityMembership = null;
      if (room.communityId) {
        communityMembership = await this.membershipRepo.findMember(
          command.actorId,
          room.communityId,
        );
      }
      allowed = RoomPolicy.canDeleteRoom(
        { id: command.actorId, role: command.actorRole },
        room.createdById,
        undefined,
        communityMembership || undefined,
      );
    } else if (command.contentType === "community") {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError("Community not found");
      
      allowed = CommunityPolicy.canDelete(
        { id: command.actorId, role: command.actorRole },
        community.createdById
      );
    }

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to moderate this content",
      );

    await prisma.$transaction(async (tx) => {
      if (command.contentType === "message") {
        await this.messageRepo.update(command.contentId, { deleted: true }, tx);
      } else if (command.contentType === "room") {
        await this.roomRepo.update(command.contentId, { deleted: true }, tx);
      } else if (command.contentType === "community") {
        await this.communityRepo.update(
          command.contentId,
          { deleted: true },
          tx,
        );
      }

      await this.auditRepo.create(
        {
          action: `content.removed`,
          targetId: command.contentId,
          targetType: command.contentType,
          details: `Removed ${command.contentType} ${command.contentId} for reason: ${command.reason}`,
          actor: { connect: { id: command.actorId } },
        },
        tx,
      );

      await EventBus.publish(
        new ContentRemovedEvent(
          command.contentId,
          command.contentType,
          command.reason,
          command.actorId,
        ),
      );

      let communityId = null;
      let roomId = null;
      if (command.contentType === "message") {
        const msg = await this.messageRepo.findById(command.contentId);
        roomId = msg?.roomId;
        if (roomId) {
          const rm = await this.roomRepo.findById(roomId);
          communityId = rm?.communityId;
        }
      } else if (command.contentType === "room") {
        roomId = command.contentId;
        const rm = await this.roomRepo.findById(roomId);
        communityId = rm?.communityId;
      } else if (command.contentType === "community") {
        communityId = command.contentId;
      }

      if (io) {
        await broadcastModerationEvent("content.removed", {
          success: true,
          data: {
            contentId: command.contentId,
            contentType: command.contentType,
            reason: command.reason,
          },
        }, null, communityId, roomId);
      }
    });
  }
}

export class RestoreContentHandler {
  constructor(messageRepo, roomRepo, communityRepo, membershipRepo, auditRepo) {
    this.messageRepo = messageRepo;
    this.roomRepo = roomRepo;
    this.communityRepo = communityRepo;
    this.membershipRepo = membershipRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    let communityId = undefined;

    if (command.contentType === "message") {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError("Message not found");
      if (!message.deleted) throw new BadRequestError("Message is not removed");

      const room = await this.roomRepo.findById(message.roomId);
      if (room && room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === "room") {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError("Room not found");
      if (!room.deleted) throw new BadRequestError("Room is not removed");
      if (room.communityId) {
        communityId = room.communityId;
      }
    } else if (command.contentType === "community") {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError("Community not found");
      if (!community.deleted)
        throw new BadRequestError("Community is not removed");
    }

    let allowed = false;

    if (command.contentType === "message") {
      const message = await this.messageRepo.findById(command.contentId);
      if (!message) throw new NotFoundError("Message not found");
      const room = await this.roomRepo.findById(message.roomId);
      
      let actorCommunityRole = null;
      if (room?.communityId) {
        const membership = await this.membershipRepo.findMember(
          command.actorId,
          room.communityId,
        );
        if (membership && !membership.banned) {
          actorCommunityRole = membership.role;
        }
      }

      let actorRoomStatus = null;
      if (message.roomId) {
        const roomMember = await prisma.roomMember.findUnique({
          where: {
            userId_roomId: {
              userId: command.actorId,
              roomId: message.roomId,
            },
          },
        });
        if (roomMember) {
          actorRoomStatus = roomMember.status;
        }
      }

      allowed = MessagePolicy.canDelete(
        { id: command.actorId, role: command.actorRole },
        message.userId,
        actorCommunityRole,
        actorRoomStatus,
      );
    } else if (command.contentType === "room") {
      const room = await this.roomRepo.findById(command.contentId);
      if (!room) throw new NotFoundError("Room not found");
      
      let communityMembership = null;
      if (room.communityId) {
        communityMembership = await this.membershipRepo.findMember(
          command.actorId,
          room.communityId,
        );
      }
      allowed = RoomPolicy.canDeleteRoom(
        { id: command.actorId, role: command.actorRole },
        room.createdById,
        undefined,
        communityMembership || undefined,
      );
    } else if (command.contentType === "community") {
      const community = await this.communityRepo.findById(command.contentId);
      if (!community) throw new NotFoundError("Community not found");
      
      allowed = CommunityPolicy.canDelete(
        { id: command.actorId, role: command.actorRole },
        community.createdById
      );
    }

    if (!allowed)
      throw new ForbiddenError(
        "You do not have permission to restore this content",
      );

    await prisma.$transaction(async (tx) => {
      if (command.contentType === "message") {
        await this.messageRepo.update(
          command.contentId,
          { deleted: false },
          tx,
        );
      } else if (command.contentType === "room") {
        await this.roomRepo.update(command.contentId, { deleted: false }, tx);
      } else if (command.contentType === "community") {
        await this.communityRepo.update(
          command.contentId,
          { deleted: false },
          tx,
        );
      }

      await this.auditRepo.create(
        {
          action: `content.restored`,
          targetId: command.contentId,
          targetType: command.contentType,
          details: `Restored ${command.contentType} ${command.contentId} for reason: ${command.reason}`,
          actor: { connect: { id: command.actorId } },
        },
        tx,
      );

      await EventBus.publish(
        new ContentRestoredEvent(
          command.contentId,
          command.contentType,
          command.reason,
          command.actorId,
        ),
      );

      let communityId = null;
      let roomId = null;
      if (command.contentType === "message") {
        const msg = await this.messageRepo.findById(command.contentId);
        roomId = msg?.roomId;
        if (roomId) {
          const rm = await this.roomRepo.findById(roomId);
          communityId = rm?.communityId;
        }
      } else if (command.contentType === "room") {
        roomId = command.contentId;
        const rm = await this.roomRepo.findById(roomId);
        communityId = rm?.communityId;
      } else if (command.contentType === "community") {
        communityId = command.contentId;
      }

      if (io) {
        await broadcastModerationEvent("content.restored", {
          success: true,
          data: {
            contentId: command.contentId,
            contentType: command.contentType,
            reason: command.reason,
          },
        }, null, communityId, roomId);
      }
    });
  }
}

export class EscalateReportCommand {
  constructor(userId, userRole, reportId, reason) {
    this.userId = userId;
    this.userRole = userRole;
    this.reportId = reportId;
    this.reason = reason;
  }
}

export class EscalateReportHandler {
  constructor(reportRepo, auditRepo) {
    this.reportRepo = reportRepo;
    this.auditRepo = auditRepo;
  }

  async execute(command) {
    const report = await this.reportRepo.findById(command.reportId);
    if (!report) throw new NotFoundError("Report not found");

    let allowed = false;
    if (["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(command.userRole)) {
      allowed = true;
    } else if (report.reportedCommunityId) {
      const membership = await prisma.communityMember.findUnique({
        where: {
          userId_communityId: { userId: command.userId, communityId: report.reportedCommunityId },
        },
      });
      if (membership && !membership.banned) {
        allowed = ["OWNER", "ADMIN", "MODERATOR"].includes(membership.role);
      }
    }

    if (!allowed) {
      throw new ForbiddenError("You do not have permission to escalate this report");
    }

    return prisma.$transaction(async (tx) => {
      const updated = await this.reportRepo.update(
        command.reportId,
        {
          status: "escalated",
          resolutionReason: `Escalated: ${command.reason}`,
        },
        tx,
      );

      await this.auditRepo.create(
        {
          action: "report.escalated",
          targetId: command.reportId,
          targetType: "Report",
          details: `Report ${command.reportId} escalated. Reason: ${command.reason}`,
          actor: { connect: { id: command.userId } },
        },
        tx,
      );

      if (io) {
        await broadcastModerationEvent("report.escalated", {
          success: true,
          data: updated,
        }, command.reportId);
      }

      await EventBus.publish(new ReportEscalatedEvent(updated.id));

      return updated;
    });
  }
}
