import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { CreateCommunityCommand, JoinCommunityCommand, LeaveCommunityCommand } from '../application/commands/CommunityCommands.js';
import type { CreateCommunityHandler, JoinCommunityHandler, LeaveCommunityHandler } from '../application/commands/CommunityCommands.js';
import { GetCommunitiesQuery, GetCommunityByIdQuery, GetCommunityMembersQuery } from '../application/queries/CommunityQueries.js';
import type { GetCommunitiesHandler, GetCommunityByIdHandler, GetCommunityMembersHandler } from '../application/queries/CommunityQueries.js';

export function createCommunitiesRouter(
  createCommunityHandler: CreateCommunityHandler,
  joinCommunityHandler: JoinCommunityHandler,
  leaveCommunityHandler: LeaveCommunityHandler,
  getCommunitiesHandler: GetCommunitiesHandler,
  getCommunityByIdHandler: GetCommunityByIdHandler,
  getCommunityMembersHandler: GetCommunityMembersHandler
): Router {
  const router = Router();

  // Get all communities
  router.get('/', async (req, res, next) => {
    try {
      const query = new GetCommunitiesQuery();
      const result = await getCommunitiesHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get community by ID
  router.get('/:id', async (req, res, next) => {
    try {
      const query = new GetCommunityByIdQuery(req.params.id as string);
      const result = await getCommunityByIdHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Create community
  router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string(),
      category: z.string().default('General'),
      imageUrl: z.string().url().optional()
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new CreateCommunityCommand(
        req.user!.id,
        parsed.data.name,
        parsed.data.description,
        parsed.data.category,
        parsed.data.imageUrl
      );
      const result = await createCommunityHandler.execute(command);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Join community
  router.post('/:id/join', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new JoinCommunityCommand(req.user!.id, req.params.id as string);
      await joinCommunityHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Leave community
  router.post('/:id/leave', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new LeaveCommunityCommand(req.user!.id, req.params.id as string);
      await leaveCommunityHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get community members
  router.get('/:id/members', async (req, res, next) => {
    try {
      const query = new GetCommunityMembersQuery(req.params.id as string);
      const result = await getCommunityMembersHandler.execute(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
