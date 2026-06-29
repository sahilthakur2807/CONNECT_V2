import { Router } from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { MarkAllNotificationsReadCommand, MarkNotificationReadCommand } from '../application/commands/NotificationCommands.js';
import type { MarkAllNotificationsReadHandler, MarkNotificationReadHandler } from '../application/commands/NotificationCommands.js';
import { GetNotificationsQuery } from '../application/queries/NotificationQueries.js';
import type { GetNotificationsHandler } from '../application/queries/NotificationQueries.js';

export function createNotificationsRouter(
  markAllReadHandler: MarkAllNotificationsReadHandler,
  markSingleReadHandler: MarkNotificationReadHandler,
  getNotificationsHandler: GetNotificationsHandler
): Router {
  const router = Router();

  // Get notifications
  router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetNotificationsQuery(req.user!.id);
      const result = await getNotificationsHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Mark all read
  router.post('/read', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new MarkAllNotificationsReadCommand(req.user!.id);
      await markAllReadHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Mark single read
  router.post('/:id/read', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new MarkNotificationReadCommand(req.user!.id, req.params.id as string);
      await markSingleReadHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
