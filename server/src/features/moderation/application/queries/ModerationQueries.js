import { ModerationPolicy } from "../ModerationPolicy.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Queries ---

export class GetReportsQuery {
  constructor(userId, userRole, type = "open") {
    this.userId = userId;
    this.userRole = userRole;
    this.type = type;
  }
}

export class GetAuditLogsQuery {
  constructor(userId, userRole, limit = 50, cursor, communityId) {
    this.userId = userId;
    this.userRole = userRole;
    this.limit = limit;
    this.cursor = cursor;
    this.communityId = communityId;
  }
}

export class GetOpenAppealsQuery {
  constructor(userId, userRole) {
    this.userId = userId;
    this.userRole = userRole;
  }
}

// --- Handlers ---

export class GetReportsHandler {
  constructor(reportRepo) {
    this.reportRepo = reportRepo;
  }

  async execute(query) {
    const actorRole = query.userRole?.toUpperCase();
    const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(actorRole);

    let reports = [];
    if (query.type === "assigned") {
      reports = await this.reportRepo.findAssignedReports(query.userId);
    } else {
      reports = await this.reportRepo.findOpenReports();
    }

    if (isPlatformStaff && ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(actorRole)) {
      return reports;
    }

    // Load moderated communities for the actor
    const communityMemberships = await prisma.communityMember.findMany({
      where: {
        userId: query.userId,
        role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
        banned: false
      },
      select: { communityId: true }
    });
    const modCommunityIds = communityMemberships.map(m => m.communityId);

    // Load moderated rooms for the actor
    const roomMemberships = await prisma.roomMember.findMany({
      where: {
        userId: query.userId,
        status: "ROOM_MOD"
      },
      select: { roomId: true }
    });
    const modRoomIds = roomMemberships.map(rm => rm.roomId);

    // Filter reports based on the actor's scope of authority
    return reports.filter(report => {
      // Scoped directly to community
      if (report.reportedCommunityId && modCommunityIds.includes(report.reportedCommunityId)) {
        return true;
      }
      // Scoped directly to room
      if (report.roomId && modRoomIds.includes(report.roomId)) {
        return true;
      }
      // Scoped to room belonging to community
      if (report.room?.communityId && modCommunityIds.includes(report.room.communityId)) {
        return true;
      }
      return false;
    });
  }
}

export class GetAuditLogsHandler {
  constructor(auditRepo) {
    this.auditRepo = auditRepo;
  }

  async execute(query) {
    const actorRole = query.userRole?.toUpperCase();

    // Check if site admin or platform moderator
    const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(actorRole);
    
    let isAuthorized = isPlatformStaff;

    // If communityId is provided, check if user is OWNER or ADMIN of that community
    if (query.communityId && !isAuthorized) {
      const membership = await prisma.communityMember.findFirst({
        where: {
          userId: query.userId,
          communityId: query.communityId,
          role: { in: ["OWNER", "ADMIN"] },
          banned: false
        }
      });
      if (membership) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new ForbiddenError("You do not have permission to view audit logs");
    }

    // Platform moderators can only view audit logs tied to their own actions
    const actorId = actorRole === "PLATFORM_MOD" ? query.userId : undefined;

    let logs = await this.auditRepo.findAuditRecords(500, query.cursor, actorId);

    if (query.communityId) {
      const rooms = await prisma.room.findMany({
        where: { communityId: query.communityId },
        select: { id: true }
      });
      const roomIds = rooms.map(r => r.id);

      logs = logs.filter(log => {
        if (log.targetType === "Community" && log.targetId === query.communityId) return true;
        if (log.targetType === "Room" && roomIds.includes(log.targetId)) return true;
        if (log.details && (log.details.includes(query.communityId) || log.details.includes(log.targetId))) return true;
        return false;
      });
    }

    // Apply the limit after filtering
    return logs.slice(0, query.limit);
  }
}

export class GetOpenAppealsHandler {
  constructor(appealRepo) {
    this.appealRepo = appealRepo;
  }

  async execute(query) {
    const allowed = ModerationPolicy.canResolveAppeal({
      id: query.userId,
      role: query.userRole,
    });
    if (!allowed)
      throw new ForbiddenError("You do not have permission to view appeals");

    return this.appealRepo.findOpenAppeals();
  }
}
