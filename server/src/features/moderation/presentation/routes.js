import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";
import { prisma } from "../../../infrastructure/db/PrismaClient.js";
import { ForbiddenError } from "../../../shared/errors/AppError.js";
import { analyzeContent } from "../infrastructure/ContentModerationService.js";

// Repositories
import { ReportRepository } from "../infrastructure/repository/ReportRepository.js";
import { ModerationActionRepository } from "../infrastructure/repository/ModerationActionRepository.js";
import { AppealRepository } from "../infrastructure/repository/AppealRepository.js";
import { AuditLogRepository } from "../infrastructure/repository/AuditLogRepository.js";

// Handlers
import {
  CreateReportHandler,
  AssignReportHandler,
  ResolveReportHandler,
  ExecuteModerationActionHandler,
  SubmitAppealHandler,
  ResolveAppealHandler,
  CreateReportCommand,
  AssignReportCommand,
  ResolveReportCommand,
  ExecuteModerationActionCommand,
  SubmitAppealCommand,
  ResolveAppealCommand,
  RemoveContentCommand,
  RemoveContentHandler,
  RestoreContentCommand,
  RestoreContentHandler,
  EscalateReportCommand,
  EscalateReportHandler,
} from "../application/commands/ModerationCommands.js";
import {
  GetReportsQuery,
  GetReportsHandler,
  GetAuditLogsQuery,
  GetAuditLogsHandler,
  GetOpenAppealsQuery,
  GetOpenAppealsHandler,
} from "../application/queries/ModerationQueries.js";

// Foreign repositories for dependency injection
import { MessageRepository } from "../../message/infrastructure/repository/MessageRepository.js";
import { RoomRepository } from "../../room/infrastructure/repository/RoomRepository.js";
import { CommunityRepository } from "../../community/infrastructure/repository/CommunityRepository.js";
import { CommunityMembershipRepository } from "../../community/infrastructure/repository/CommunityMembershipRepository.js";

const reportRepo = new ReportRepository();
const actionRepo = new ModerationActionRepository();
const appealRepo = new AppealRepository();
const auditRepo = new AuditLogRepository();

const messageRepo = new MessageRepository();
const roomRepo = new RoomRepository();
const communityRepo = new CommunityRepository();
const membershipRepo = new CommunityMembershipRepository();

const createReportHandler = new CreateReportHandler(reportRepo);
const assignReportHandler = new AssignReportHandler(reportRepo, auditRepo);
const resolveReportHandler = new ResolveReportHandler(reportRepo, auditRepo);
const executeModerationActionHandler = new ExecuteModerationActionHandler(
  actionRepo,
  auditRepo,
  membershipRepo,
);
const escalateReportHandler = new EscalateReportHandler(reportRepo, auditRepo);
const submitAppealHandler = new SubmitAppealHandler(appealRepo);
const resolveAppealHandler = new ResolveAppealHandler(
  appealRepo,
  actionRepo,
  auditRepo,
);
const removeContentHandler = new RemoveContentHandler(
  messageRepo,
  roomRepo,
  communityRepo,
  membershipRepo,
  auditRepo,
);
const restoreContentHandler = new RestoreContentHandler(
  messageRepo,
  roomRepo,
  communityRepo,
  membershipRepo,
  auditRepo,
);

const getReportsHandler = new GetReportsHandler(reportRepo);
const getAuditLogsHandler = new GetAuditLogsHandler(auditRepo);
const getOpenAppealsHandler = new GetOpenAppealsHandler(appealRepo);

export function createModerationRouter() {
  const router = Router();

  // 1. Create Report
  router.post("/reports", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3).max(100),
      description: z.string().min(5).max(1000),
      reportedUserId: z.string().optional(),
      messageId: z.string().optional(),
      roomId: z.string().optional(),
      reportedCommunityId: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new CreateReportCommand(
        req.user.id,
        parsed.reason,
        parsed.description,
        parsed.reportedUserId,
        parsed.messageId,
        parsed.roomId,
        parsed.reportedCommunityId,
      );

      const result = await createReportHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Assign Report
  router.post(
    "/reports/:id/assign",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({ moderatorId: z.string().min(1) });
      try {
        const parsed = schema.parse(req.body);
        const command = new AssignReportCommand(
          req.user.id,
          req.user.role,
          req.params.id,
          parsed.moderatorId,
        );

        const result = await assignReportHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 3. Resolve Report
  router.post(
    "/reports/:id/resolve",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        resolutionReason: z.string().min(5).max(1000),
      });
      try {
        const parsed = schema.parse(req.body);
        const command = new ResolveReportCommand(
          req.user.id,
          req.user.role,
          req.params.id,
          parsed.resolutionReason,
        );

        const result = await resolveReportHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 3b. Escalate Report
  router.post(
    "/reports/:id/escalate",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        reason: z.string().min(5).max(1000),
      });
      try {
        const parsed = schema.parse(req.body);
        const command = new EscalateReportCommand(
          req.user.id,
          req.user.role,
          req.params.id,
          parsed.reason,
        );

        const result = await escalateReportHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 4. Execute Moderation Action (Warn, Mute, Suspend, Ban)
  router.post(
    "/moderation/actions",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        targetUserId: z.string().min(1),
        type: z.enum(["warn", "mute", "suspend", "ban"]),
        reason: z.string().min(5).max(1000),
        expiresAt: z.preprocess(
          (val) => (val ? new Date(val) : undefined),
          z.date().optional(),
        ),
        communityId: z.string().optional(),
        roomId: z.string().optional(),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new ExecuteModerationActionCommand(
          req.user.id,
          req.user.role,
          parsed.targetUserId,
          parsed.type,
          parsed.reason,
          parsed.expiresAt,
          parsed.communityId,
          parsed.roomId,
        );

        const result = await executeModerationActionHandler.execute(command);
        res.status(201).json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 5. Submit Appeal
  router.post("/appeals", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      actionId: z.string().min(1),
      reason: z.string().min(10).max(1000),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new SubmitAppealCommand(
        req.user.id,
        parsed.actionId,
        parsed.reason,
      );

      const result = await submitAppealHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Resolve Appeal
  router.post(
    "/appeals/:id/resolve",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        status: z.enum(["approved", "rejected"]),
        resolution: z.string().min(5).max(1000),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new ResolveAppealCommand(
          req.user.id,
          req.user.role,
          req.params.id,
          parsed.status,
          parsed.resolution,
        );

        const result = await resolveAppealHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 7. Get Reports (Open / Assigned)
  router.get("/reports", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      type: z.enum(["open", "assigned", "escalated"]).default("open"),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetReportsQuery(
        req.user.id,
        req.user.role,
        parsed.type,
      );

      const result = await getReportsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 8. Get Audit Logs (Cursor-based)
  router.get("/audit-logs", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      limit: z.preprocess(
        (val) => parseInt(val) || 50,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
      communityId: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetAuditLogsQuery(
        req.user.id,
        req.user.role,
        parsed.limit,
        parsed.cursor,
        parsed.communityId,
      );

      const result = await getAuditLogsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 9. Get Open Appeals
  router.get("/appeals", authenticateJWT, async (req, res, next) => {
    try {
      const query = new GetOpenAppealsQuery(req.user.id, req.user.role);

      const result = await getOpenAppealsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 10. Remove Content Administratively
  router.post(
    "/moderation/content/remove",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        contentType: z.enum(["message", "room", "community"]),
        contentId: z.string().min(1),
        reason: z.string().min(5).max(1000),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new RemoveContentCommand(
          req.user.id,
          req.user.role,
          parsed.contentType,
          parsed.contentId,
          parsed.reason,
        );

        await removeContentHandler.execute(command);
        res.json({ success: true, message: "Content successfully removed" });
      } catch (err) {
        next(err);
      }
    },
  );

  // 11. Restore Content Administratively
  router.post(
    "/moderation/content/restore",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        contentType: z.enum(["message", "room", "community"]),
        contentId: z.string().min(1),
        reason: z.string().min(5).max(1000),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new RestoreContentCommand(
          req.user.id,
          req.user.role,
          parsed.contentType,
          parsed.contentId,
          parsed.reason,
        );

        await restoreContentHandler.execute(command);
        res.json({ success: true, message: "Content successfully restored" });
      } catch (err) {
        next(err);
      }
    },
  );

  // 12. User Lookup (for Moderator/Admin panel)
  router.get(
    "/moderation/users/lookup",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        query: z.string().min(1),
        communityId: z.string().optional(),
        suggest: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
      });

      try {
        const parsed = schema.parse(req.query);
        const actorRole = req.user.role?.toUpperCase();
        const actorId = req.user.id;

        if (parsed.suggest) {
          const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(actorRole);
          const actorMemberships = await prisma.communityMember.findMany({
            where: {
              userId: actorId,
              role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
              banned: false,
            }
          });
          const actorCommunityIds = actorMemberships.map(m => m.communityId);

          const roomMemberships = await prisma.roomMember.findMany({
            where: {
              userId: actorId,
              status: "ROOM_MOD"
            }
          });
          const actorRoomIds = roomMemberships.map(rm => rm.roomId);

          if (!isPlatformStaff && actorCommunityIds.length === 0 && actorRoomIds.length === 0) {
            throw new ForbiddenError("You do not have permission to access user suggestions");
          }

          // Build suggestion where clause
          const suggestWhere = {
            OR: [
              { username: { contains: parsed.query, mode: "insensitive" } },
              { name: { contains: parsed.query, mode: "insensitive" } },
              { email: { contains: parsed.query, mode: "insensitive" } },
              { id: { contains: parsed.query } }
            ]
          };

          // If not platform staff, restrict suggestions to users in the same communities or rooms
          if (!isPlatformStaff) {
            suggestWhere.AND = [
              {
                OR: [
                  {
                    communities: {
                      some: {
                        communityId: { in: actorCommunityIds }
                      }
                    }
                  },
                  {
                    rooms: {
                      some: {
                        roomId: { in: actorRoomIds }
                      }
                    }
                  }
                ]
              }
            ];
          }

          const users = await prisma.user.findMany({
            where: suggestWhere,
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
              avatar: true,
              role: true
            },
            take: 10
          });

          return res.json({ success: true, data: users });
        }

        let targetUser = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: parsed.query, mode: "insensitive" } },
              { id: parsed.query },
              { email: { equals: parsed.query, mode: "insensitive" } }
            ]
          },
          select: {
            id: true,
            username: true,
            email: true,
            name: true,
            avatar: true,
            bio: true,
            verified: true,
            badges: true,
            reputation: true,
            role: true,
            status: true,
            createdAt: true,
          }
        });

        if (!targetUser) {
          // Fallback to partial match if no exact match is found
          targetUser = await prisma.user.findFirst({
            where: {
              OR: [
                { username: { contains: parsed.query, mode: "insensitive" } },
                { name: { contains: parsed.query, mode: "insensitive" } },
                { email: { contains: parsed.query, mode: "insensitive" } },
                { id: { contains: parsed.query } }
              ]
            },
            select: {
              id: true,
              username: true,
              email: true,
              name: true,
              avatar: true,
              bio: true,
              verified: true,
              badges: true,
              reputation: true,
              role: true,
              status: true,
              createdAt: true,
            }
          });
        }

        if (!targetUser) {
          return res.status(404).json({ success: false, error: "User not found" });
        }

        const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(actorRole);
        let isAuthorized = isPlatformStaff;
        let activeCommunityId = parsed.communityId;

        const actorMemberships = await prisma.communityMember.findMany({
          where: {
            userId: actorId,
            role: { in: ["OWNER", "ADMIN", "MODERATOR"] },
            banned: false,
          }
        });

        const actorCommunityIds = actorMemberships.map(m => m.communityId);

        if (!isAuthorized) {
          const targetMembership = await prisma.communityMember.findFirst({
            where: {
              userId: targetUser.id,
              communityId: { in: actorCommunityIds }
            }
          });
          if (targetMembership) {
            isAuthorized = true;
            activeCommunityId = targetMembership.communityId;
          }
        }

        if (!isAuthorized) {
          const roomMemberships = await prisma.roomMember.findMany({
            where: {
              userId: actorId,
              status: "ROOM_MOD"
            }
          });
          const actorRoomIds = roomMemberships.map(rm => rm.roomId);
          const targetInSameRoom = await prisma.roomMember.findFirst({
            where: {
              userId: targetUser.id,
              roomId: { in: actorRoomIds }
            }
          });
          if (targetInSameRoom) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          throw new ForbiddenError("You do not have permission to look up this user");
        }

        const historyWhere = {
          userId: targetUser.id
        };

        if (!isPlatformStaff) {
          historyWhere.communityId = { in: actorCommunityIds };
        } else if (activeCommunityId) {
          historyWhere.communityId = activeCommunityId;
        }

        const actions = await prisma.moderationAction.findMany({
          where: historyWhere,
          orderBy: { createdAt: "desc" },
          include: {
            actor: {
              select: {
                id: true,
                username: true,
                name: true
              }
            }
          }
        });

        res.json({
          success: true,
          data: {
            user: targetUser,
            history: actions
          }
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // 13. Revoke Restriction (Deactivate mute/ban/suspension)
  router.post(
    "/moderation/restrictions/:actionId/revoke",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        reason: z.string().min(5).max(1000),
      });

      try {
        const parsed = schema.parse(req.body);
        const actionId = req.params.actionId;
        const actorRole = req.user.role?.toUpperCase();

        const action = await prisma.moderationAction.findUnique({
          where: { id: actionId }
        });

        if (!action) {
          return res.status(404).json({ success: false, error: "Restriction not found" });
        }

        const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(actorRole);
        let isAuthorized = isPlatformStaff;

        if (!isAuthorized && action.communityId) {
          const membership = await prisma.communityMember.findFirst({
            where: {
              userId: req.user.id,
              communityId: action.communityId,
              role: { in: ["OWNER", "ADMIN"] },
              banned: false
            }
          });
          if (membership) {
            isAuthorized = true;
          }
        }

        if (!isAuthorized) {
          throw new ForbiddenError("You do not have permission to revoke this restriction");
        }

        await prisma.moderationAction.update({
          where: { id: actionId },
          data: { active: false }
        });

        // Log the revocation in audit logs
        await prisma.auditLog.create({
          data: {
            action: "moderation.action.revoked",
            targetId: actionId,
            targetType: "ModerationAction",
            details: `Enforcement action ${actionId} (${action.type}) revoked. Reason: ${parsed.reason}`,
            actorId: req.user.id
          }
        });

        res.json({ success: true, message: "Restriction successfully revoked" });
      } catch (err) {
        next(err);
      }
    }
  );

  // 14. Real-time Content Moderation Analysis (for client-side pre-send check)
  // Rate-limited to 60 requests per minute per user to prevent HF API abuse.
  const analyzeLimiter = (() => {
    const userCounts = new Map(); // userId → { count, windowStart }
    const WINDOW_MS = 60_000;
    const MAX_REQUESTS = 60;
    return (userId) => {
      const now = Date.now();
      const entry = userCounts.get(userId);
      if (!entry || now - entry.windowStart > WINDOW_MS) {
        userCounts.set(userId, { count: 1, windowStart: now });
        return true; // allowed
      }
      if (entry.count >= MAX_REQUESTS) return false; // blocked
      entry.count++;
      return true; // allowed
    };
  })();

  router.post(
    "/moderation/analyze",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const schema = z.object({
          text: z.string().min(1).max(5000),
        });
        const { text } = schema.parse(req.body);

        // Per-user rate limiting
        if (!analyzeLimiter(req.user.id)) {
          return res.status(429).json({
            success: false,
            error: { code: "RATE_LIMITED", message: "Too many moderation checks. Please slow down." },
          });
        }

        const result = await analyzeContent(text);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
export const moderationRouter = createModerationRouter();
