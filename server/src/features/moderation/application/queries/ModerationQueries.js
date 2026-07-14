import { ModerationPolicy } from "../ModerationPolicy.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";

// --- Queries ---

export class GetReportsQuery {
  constructor(userId, userRole, type = "open") {
    this.userId = userId;
    this.userRole = userRole;
    this.type = type;
  }
}

export class GetAuditLogsQuery {
  constructor(userId, userRole, limit = 50, cursor) {
    this.userId = userId;
    this.userRole = userRole;
    this.limit = limit;
    this.cursor = cursor;
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
    const allowed = ModerationPolicy.canManageReport({
      id: query.userId,
      role: query.userRole,
    });
    if (!allowed)
      throw new ForbiddenError("You do not have permission to view reports");

    if (query.type === "assigned") {
      return this.reportRepo.findAssignedReports(query.userId);
    }
    return this.reportRepo.findOpenReports();
  }
}

export class GetAuditLogsHandler {
  constructor(auditRepo) {
    this.auditRepo = auditRepo;
  }

  async execute(query) {
    const allowed = ModerationPolicy.canViewAuditLogs({
      id: query.userId,
      role: query.userRole,
    });
    if (!allowed)
      throw new ForbiddenError("You do not have permission to view audit logs");

    // Platform moderators can only view audit logs tied to their own actions
    const actorId = query.userRole === "PLATFORM_MOD" ? query.userId : undefined;

    return this.auditRepo.findAuditRecords(query.limit, query.cursor, actorId);
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
