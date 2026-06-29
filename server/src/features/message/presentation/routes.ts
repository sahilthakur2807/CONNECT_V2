import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { EditMessageCommand, DeleteMessageCommand, CreateReplyCommand, ToggleReactionCommand } from '../application/commands/MessageCommands.js';
import type { EditMessageHandler, DeleteMessageHandler, CreateReplyHandler, ToggleReactionHandler } from '../application/commands/MessageCommands.js';
import { GetTrendingMessagesQuery } from '../application/queries/MessageQueries.js';
import type { GetTrendingMessagesHandler } from '../application/queries/MessageQueries.js';

export function createMessagesRouter(
  editMessageHandler: EditMessageHandler,
  deleteMessageHandler: DeleteMessageHandler,
  createReplyHandler: CreateReplyHandler,
  toggleReactionHandler: ToggleReactionHandler,
  getTrendingMessagesHandler: GetTrendingMessagesHandler
): Router {
  const router = Router();

  // Get trending messages for Hot Debates
  router.get('/trending', async (req, res, next) => {
    try {
      const query = new GetTrendingMessagesQuery();
      const result = await getTrendingMessagesHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Edit message
  router.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const messageSchema = z.object({ content: z.string().min(1) });
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new EditMessageCommand(
        req.params.id as string,
        parsed.data.content,
        req.user!.id,
        req.user!.role
      );
      const result = await editMessageHandler.execute(command);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Delete message
  router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new DeleteMessageCommand(
        req.params.id as string,
        req.user!.id,
        req.user!.role
      );
      await deleteMessageHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Create reply (posting with parentId)
  router.post('/:messageId/replies', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const messageSchema = z.object({ content: z.string().min(1) });
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new CreateReplyCommand(
        req.params.messageId as string,
        parsed.data.content,
        req.user!.id
      );
      const result = await createReplyHandler.execute(command);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Toggle Reaction
  router.post('/:messageId/reactions', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const reactionSchema = z.object({ emoji: z.string() });
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new ToggleReactionCommand(
        req.params.messageId as string,
        parsed.data.emoji,
        req.user!.id
      );
      await toggleReactionHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
