import { Router } from 'express';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { LookupRoomQuery, CreateExtensionRoomCommand, JoinExtensionRoomCommand } from '../application/commands/ExtensionCommands.js';
import type { LookupRoomHandler, CreateExtensionRoomHandler, JoinExtensionRoomHandler } from '../application/commands/ExtensionCommands.js';

export function createExtensionRouter(
  lookupRoomHandler: LookupRoomHandler,
  createRoomHandler: CreateExtensionRoomHandler,
  joinRoomHandler: JoinExtensionRoomHandler
): Router {
  const router = Router();

  // Extension Lookup
  router.post('/rooms/lookup', async (req, res, next) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }
      const query = new LookupRoomQuery(url as string);
      const result = await lookupRoomHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Extension Create Room
  router.post('/rooms', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { url, title, description, source } = req.body;
      if (!url || !title) {
        return res.status(400).json({ error: 'URL and title are required' });
      }
      const command = new CreateExtensionRoomCommand(
        req.user!.id,
        url,
        title,
        description,
        source
      );
      const room = await createRoomHandler.execute(command);
      res.json({ room });
    } catch (err) {
      next(err);
    }
  });

  // Extension Join Room
  router.post('/rooms/:roomId/join', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new JoinExtensionRoomCommand(
        req.user!.id,
        req.params.roomId as string
      );
      await joinRoomHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
