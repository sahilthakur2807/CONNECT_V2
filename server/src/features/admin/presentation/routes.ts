import { Router } from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import type { GetSettingsQueryHandler } from '../application/queries/GetSettingsQuery.js';
import type { UpdateSettingsHandler } from '../application/commands/UpdateSettingsCommand.js';
import { GetSettingsQuery } from '../application/queries/GetSettingsQuery.js';
import { UpdateSettingsCommand } from '../application/commands/UpdateSettingsCommand.js';

export function createAdminRouter(
  getSettingsHandler: GetSettingsQueryHandler,
  updateSettingsHandler: UpdateSettingsHandler
): Router {
  const router = Router();

  router.get('/settings', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      if (req.user!.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
      }
      const query = new GetSettingsQuery();
      const settings = await getSettingsHandler.execute(query);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  });

  router.post('/settings', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      if (req.user!.role !== 'superadmin') {
        return res.status(403).json({ error: 'Access denied: Super Admin only' });
      }
      const updates = req.body;
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Invalid settings body' });
      }
      const command = new UpdateSettingsCommand(updates);
      await updateSettingsHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
