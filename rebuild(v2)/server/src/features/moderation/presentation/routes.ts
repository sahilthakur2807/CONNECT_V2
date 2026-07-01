import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '../../../presentation/middlewares/AuthMiddleware.js';

// Repositories
import { ReportRepository } from '../infrastructure/repository/ReportRepository.js';
import { ModerationActionRepository } from '../infrastructure/repository/ModerationActionRepository.js';
import { AppealRepository } from '../infrastructure/repository/AppealRepository.js';
import { AuditLogRepository } from '../infrastructure/repository/AuditLogRepository.js';

// Handlers
import { CreateReportHandler, AssignReportHandler, ResolveReportHandler, ExecuteModerationActionHandler, SubmitAppealHandler, ResolveAppealHandler, CreateReportCommand, AssignReportCommand, ResolveReportCommand, ExecuteModerationActionCommand, SubmitAppealCommand, ResolveAppealCommand, RemoveContentCommand, RemoveContentHandler, RestoreContentCommand, RestoreContentHandler } from '../application/commands/ModerationCommands.js';
import { GetReportsQuery, GetReportsHandler, GetAuditLogsQuery, GetAuditLogsHandler, GetOpenAppealsQuery, GetOpenAppealsHandler } from '../application/queries/ModerationQueries.js';

// Foreign repositories for dependency injection
import { MessageRepository } from '../../message/infrastructure/repository/MessageRepository.js';
import { RoomRepository } from '../../room/infrastructure/repository/RoomRepository.js';
import { CommunityRepository } from '../../community/infrastructure/repository/CommunityRepository.js';
import { CommunityMembershipRepository } from '../../community/infrastructure/repository/CommunityMembershipRepository.js';

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
const executeModerationActionHandler = new ExecuteModerationActionHandler(actionRepo, auditRepo, membershipRepo);
const submitAppealHandler = new SubmitAppealHandler(appealRepo);
const resolveAppealHandler = new ResolveAppealHandler(appealRepo, actionRepo, auditRepo);
const removeContentHandler = new RemoveContentHandler(
  messageRepo,
  roomRepo,
  communityRepo,
  membershipRepo,
  auditRepo
);
const restoreContentHandler = new RestoreContentHandler(
  messageRepo,
  roomRepo,
  communityRepo,
  membershipRepo,
  auditRepo
);

const getReportsHandler = new GetReportsHandler(reportRepo);
const getAuditLogsHandler = new GetAuditLogsHandler(auditRepo);
const getOpenAppealsHandler = new GetOpenAppealsHandler(appealRepo);

export function createModerationRouter(): Router {
  const router = Router();

  // 1. Create Report
  router.post('/reports', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      reason: z.string().min(3).max(100),
      description: z.string().min(5).max(1000),
      reportedUserId: z.string().optional(),
      messageId: z.string().optional(),
      roomId: z.string().optional(),
      reportedCommunityId: z.string().optional()
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new CreateReportCommand(
        req.user!.id,
        parsed.reason,
        parsed.description,
        parsed.reportedUserId,
        parsed.messageId,
        parsed.roomId,
        parsed.reportedCommunityId
      );

      const result = await createReportHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Assign Report
  router.post('/reports/:id/assign', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({ moderatorId: z.string().min(1) });
    try {
      const parsed = schema.parse(req.body);
      const command = new AssignReportCommand(
        req.user!.id,
        req.user!.role,
        req.params.id as string,
        parsed.moderatorId
      );

      const result = await assignReportHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 3. Resolve Report
  router.post('/reports/:id/resolve', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({ resolutionReason: z.string().min(5).max(1000) });
    try {
      const parsed = schema.parse(req.body);
      const command = new ResolveReportCommand(
        req.user!.id,
        req.user!.role,
        req.params.id as string,
        parsed.resolutionReason
      );

      const result = await resolveReportHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Execute Moderation Action (Warn, Mute, Suspend, Ban)
  router.post('/moderation/actions', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      targetUserId: z.string().min(1),
      type: z.enum(['warn', 'mute', 'suspend', 'ban']),
      reason: z.string().min(5).max(1000),
      expiresAt: z.preprocess((val) => val ? new Date(val as string) : undefined, z.date().optional()),
      communityId: z.string().optional()
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new ExecuteModerationActionCommand(
        req.user!.id,
        req.user!.role,
        parsed.targetUserId,
        parsed.type,
        parsed.reason,
        parsed.expiresAt,
        parsed.communityId
      );

      const result = await executeModerationActionHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 5. Submit Appeal
  router.post('/appeals', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      actionId: z.string().min(1),
      reason: z.string().min(10).max(1000)
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new SubmitAppealCommand(
        req.user!.id,
        parsed.actionId,
        parsed.reason
      );

      const result = await submitAppealHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Resolve Appeal
  router.post('/appeals/:id/resolve', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      status: z.enum(['approved', 'rejected']),
      resolution: z.string().min(5).max(1000)
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new ResolveAppealCommand(
        req.user!.id,
        req.user!.role,
        req.params.id as string,
        parsed.status,
        parsed.resolution
      );

      const result = await resolveAppealHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 7. Get Reports (Open / Assigned)
  router.get('/reports', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      type: z.enum(['open', 'assigned']).default('open')
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetReportsQuery(
        req.user!.id,
        req.user!.role,
        parsed.type
      );

      const result = await getReportsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 8. Get Audit Logs (Cursor-based)
  router.get('/audit-logs', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      limit: z.preprocess((val) => parseInt(val as string) || 50, z.number().min(1).max(100)),
      cursor: z.string().optional()
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetAuditLogsQuery(
        req.user!.id,
        req.user!.role,
        parsed.limit,
        parsed.cursor
      );

      const result = await getAuditLogsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 9. Get Open Appeals
  router.get('/appeals', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetOpenAppealsQuery(
        req.user!.id,
        req.user!.role
      );

      const result = await getOpenAppealsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 10. Remove Content Administratively
  router.post('/moderation/content/remove', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      contentType: z.enum(['message', 'room', 'community']),
      contentId: z.string().min(1),
      reason: z.string().min(5).max(1000)
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new RemoveContentCommand(
        req.user!.id,
        req.user!.role,
        parsed.contentType,
        parsed.contentId,
        parsed.reason
      );

      await removeContentHandler.execute(command);
      res.json({ success: true, message: 'Content successfully removed' });
    } catch (err) {
      next(err);
    }
  });

  // 11. Restore Content Administratively
  router.post('/moderation/content/restore', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      contentType: z.enum(['message', 'room', 'community']),
      contentId: z.string().min(1),
      reason: z.string().min(5).max(1000)
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new RestoreContentCommand(
        req.user!.id,
        req.user!.role,
        parsed.contentType,
        parsed.contentId,
        parsed.reason
      );

      await restoreContentHandler.execute(command);
      res.json({ success: true, message: 'Content successfully restored' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const moderationRouter = createModerationRouter();
