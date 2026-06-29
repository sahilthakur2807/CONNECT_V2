import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { CreateReportCommand, UpdateReportCommand } from '../application/commands/ReportCommands.js';
import type { CreateReportHandler, UpdateReportHandler } from '../application/commands/ReportCommands.js';
import { GetReportsQuery } from '../application/queries/ReportQueries.js';
import type { GetReportsHandler } from '../application/queries/ReportQueries.js';

export function createReportsRouter(
  createReportHandler: CreateReportHandler,
  updateReportHandler: UpdateReportHandler,
  getReportsHandler: GetReportsHandler
): Router {
  const router = Router();

  // Get reports
  router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetReportsQuery(req.user!.id, req.user!.role);
      const result = await getReportsHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Create report
  router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const reportSchema = z.object({
      reason: z.string().min(2),
      description: z.string().min(5),
      severity: z.string().optional().default('medium'),
      reportedUserId: z.string().optional(),
      messageId: z.string().optional(),
      roomId: z.string().optional()
    });

    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new CreateReportCommand(
        req.user!.id,
        parsed.data.reason,
        parsed.data.description,
        parsed.data.severity,
        parsed.data.reportedUserId,
        parsed.data.messageId,
        parsed.data.roomId
      );
      const result = await createReportHandler.execute(command);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Update report
  router.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const reportSchema = z.object({ status: z.string() });
    const parsed = reportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new UpdateReportCommand(
        req.params.id as string,
        parsed.data.status,
        req.user!.id,
        req.user!.role
      );
      const result = await updateReportHandler.execute(command);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
