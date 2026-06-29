import { Router } from 'express';
import { z } from 'zod';
import { authenticateJWT, optionalJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { CreateRoomCommand, JoinRoomCommand, LeaveRoomCommand, CreateRoomMessageCommand } from '../application/commands/RoomCommands.js';
import type { CreateRoomHandler, JoinRoomHandler, LeaveRoomHandler, CreateRoomMessageHandler } from '../application/commands/RoomCommands.js';
import { GetRoomsQuery, GetTrendingRoomsQuery, GetHotRoomsQuery, GetNewRoomsQuery, GetRoomByIdQuery, GetRoomMessagesQuery } from '../application/queries/RoomQueries.js';
import type { GetRoomsHandler, GetTrendingRoomsHandler, GetHotRoomsHandler, GetNewRoomsHandler, GetRoomByIdHandler, GetRoomMessagesHandler } from '../application/queries/RoomQueries.js';

export function createRoomsRouter(
  createRoomHandler: CreateRoomHandler,
  joinRoomHandler: JoinRoomHandler,
  leaveRoomHandler: LeaveRoomHandler,
  createRoomMessageHandler: CreateRoomMessageHandler,
  getRoomsHandler: GetRoomsHandler,
  getTrendingRoomsHandler: GetTrendingRoomsHandler,
  getHotRoomsHandler: GetHotRoomsHandler,
  getNewRoomsHandler: GetNewRoomsHandler,
  getRoomByIdHandler: GetRoomByIdHandler,
  getRoomMessagesHandler: GetRoomMessagesHandler
): Router {
  const router = Router();

  // Get rooms
  router.get('/', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const { communityId, category } = req.query;
      const query = new GetRoomsQuery(
        req.user?.id,
        communityId as string,
        category as string
      );
      const rooms = await getRoomsHandler.execute(query);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  });

  // Get trending rooms
  router.get('/trending', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetTrendingRoomsQuery(req.user?.id);
      const rooms = await getTrendingRoomsHandler.execute(query);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  });

  // Get hot rooms
  router.get('/hot', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetHotRoomsQuery(req.user?.id);
      const rooms = await getHotRoomsHandler.execute(query);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  });

  // Get new rooms
  router.get('/new', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const query = new GetNewRoomsQuery(req.user?.id);
      const rooms = await getNewRoomsHandler.execute(query);
      res.json(rooms);
    } catch (err) {
      next(err);
    }
  });

  // Get room details
  router.get('/:id', async (req, res, next) => {
    try {
      const query = new GetRoomByIdQuery(req.params.id as string);
      const room = await getRoomByIdHandler.execute(query);
      res.json(room);
    } catch (err) {
      next(err);
    }
  });

  // Create room
  router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const roomSchema = z.object({
      title: z.string().min(3),
      description: z.string(),
      category: z.string(),
      tags: z.array(z.string()).optional().default([]),
      communityId: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      imageUrl: z.string().url().optional()
    });

    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new CreateRoomCommand(
        req.user!.id,
        parsed.data.title,
        parsed.data.description,
        parsed.data.category,
        parsed.data.tags,
        parsed.data.communityId,
        parsed.data.sourceUrl,
        parsed.data.imageUrl
      );
      const room = await createRoomHandler.execute(command);
      res.status(201).json(room);
    } catch (err) {
      next(err);
    }
  });

  // Join room
  router.post('/:id/join', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new JoinRoomCommand(req.user!.id, req.params.id as string);
      await joinRoomHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Leave room
  router.post('/:id/leave', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new LeaveRoomCommand(req.user!.id, req.params.id as string);
      await leaveRoomHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Get messages for a room
  router.get('/:roomId/messages', async (req, res, next) => {
    try {
      const query = new GetRoomMessagesQuery(req.params.roomId as string);
      const messages = await getRoomMessagesHandler.execute(query);
      res.json(messages);
    } catch (err) {
      next(err);
    }
  });

  // Create message in room
  router.post('/:roomId/messages', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const messageSchema = z.object({
      content: z.string().min(1),
      parentId: z.string().optional()
    });

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new CreateRoomMessageCommand(
        req.user!.id,
        req.params.roomId as string,
        parsed.data.content,
        parsed.data.parentId
      );
      const message = await createRoomMessageHandler.execute(command);
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
