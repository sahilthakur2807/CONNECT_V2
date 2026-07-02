import { Router } from "express";
import { z } from "zod";
import {
  authenticateJWT,
  optionalJWT,
} from "../../../presentation/middlewares/AuthMiddleware.js";

// Repositories
import { RoomRepository } from "../infrastructure/repository/RoomRepository.js";
import { CommunityRepository } from "../../community/infrastructure/repository/CommunityRepository.js";
import { CommunityMembershipRepository } from "../../community/infrastructure/repository/CommunityMembershipRepository.js";

// Handlers
import {
  CreateRoomCommand,
  CreateRoomHandler,
  UpdateRoomCommand,
  UpdateRoomHandler,
  ArchiveRoomCommand,
  ArchiveRoomHandler,
  DeleteRoomCommand,
  DeleteRoomHandler,
} from "../application/commands/RoomCommands.js";
import {
  GetRoomsQuery,
  GetRoomsHandler,
  GetTrendingRoomsQuery,
  GetTrendingRoomsHandler,
  GetHotRoomsQuery,
  GetHotRoomsHandler,
  GetNewRoomsQuery,
  GetNewRoomsHandler,
  GetRoomByIdQuery,
  GetRoomByIdHandler,
} from "../application/queries/RoomQueries.js";

const roomRepo = new RoomRepository();
const communityRepo = new CommunityRepository();
const membershipRepo = new CommunityMembershipRepository();

const createRoomHandler = new CreateRoomHandler(
  roomRepo,
  communityRepo,
  membershipRepo,
);
const updateRoomHandler = new UpdateRoomHandler(
  roomRepo,
  communityRepo,
  membershipRepo,
);
const archiveRoomHandler = new ArchiveRoomHandler(
  roomRepo,
  communityRepo,
  membershipRepo,
);
const deleteRoomHandler = new DeleteRoomHandler(
  roomRepo,
  communityRepo,
  membershipRepo,
);

const getRoomsHandler = new GetRoomsHandler(roomRepo);
const getTrendingRoomsHandler = new GetTrendingRoomsHandler(roomRepo);
const getHotRoomsHandler = new GetHotRoomsHandler(roomRepo);
const getNewRoomsHandler = new GetNewRoomsHandler(roomRepo);
const getRoomByIdHandler = new GetRoomByIdHandler(roomRepo);

export function createRoomsRouter() {
  const router = Router();

  // 1. Get visible rooms
  router.get("/", optionalJWT, async (req, res, next) => {
    const communityId = req.query.communityId;
    const category = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user?.id;

    try {
      const query = new GetRoomsQuery(
        communityId,
        category,
        page,
        limit,
        userId,
      );
      const result = await getRoomsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Get trending rooms
  router.get("/trending", optionalJWT, async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user?.id;
    try {
      const query = new GetTrendingRoomsQuery(limit, userId);
      const result = await getTrendingRoomsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 3. Get hot rooms
  router.get("/hot", optionalJWT, async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user?.id;
    try {
      const query = new GetHotRoomsQuery(limit, userId);
      const result = await getHotRoomsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Get new rooms
  router.get("/new", optionalJWT, async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 20;
    const userId = req.user?.id;
    try {
      const query = new GetNewRoomsQuery(limit, userId);
      const result = await getNewRoomsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 5. Get room details
  router.get("/:id", optionalJWT, async (req, res, next) => {
    const userId = req.user?.id;
    try {
      const query = new GetRoomByIdQuery(req.params.id, userId);
      const result = await getRoomByIdHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Create room
  router.post("/", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      title: z.string().min(3).max(100),
      description: z.string().min(10).max(500),
      category: z.string().min(2).max(30),
      tags: z.array(z.string()).optional().default([]),
      communityId: z.string().optional(),
      sourceUrl: z.string().url().optional(),
      imageUrl: z.string().url().optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new CreateRoomCommand(
        req.user.id,
        parsed.title,
        parsed.description,
        parsed.category,
        parsed.tags,
        parsed.communityId,
        parsed.sourceUrl,
        parsed.imageUrl,
      );
      const result = await createRoomHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 7. Update room
  router.patch("/:id", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      title: z.string().min(3).max(100).optional(),
      description: z.string().min(10).max(500).optional(),
      category: z.string().min(2).max(30).optional(),
      tags: z.array(z.string()).optional(),
      imageUrl: z.string().url().optional(),
      isPrivate: z.boolean().optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new UpdateRoomCommand(
        req.user.id,
        req.params.id,
        parsed.title,
        parsed.description,
        parsed.category,
        parsed.tags,
        parsed.imageUrl,
        parsed.isPrivate,
      );
      const result = await updateRoomHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 8. Archive room
  router.post("/:id/archive", authenticateJWT, async (req, res, next) => {
    try {
      const command = new ArchiveRoomCommand(req.user.id, req.params.id);
      const result = await archiveRoomHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 9. Delete room (soft delete)
  router.delete("/:id", authenticateJWT, async (req, res, next) => {
    try {
      const command = new DeleteRoomCommand(
        req.user.id,
        req.params.id,
        req.user.role,
      );
      await deleteRoomHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 10. Join room
  router.post("/:id/join", authenticateJWT, async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id;

      // Check if room exists
      const room = await roomRepo.findById(roomId);
      if (!room || room.deleted) {
        res.status(404).json({ success: false, error: "Room not found" });
        return;
      }

      // Check if already a member
      const existing = await roomRepo.findMembership(userId, roomId);

      if (!existing) {
        const status = room.isPrivate ? "pending" : "joined";
        await roomRepo.createMembership(userId, roomId, status);
        res.json({ success: true, data: { isJoined: !room.isPrivate, isPending: room.isPrivate } });
      } else {
        res.json({ success: true, data: { isJoined: existing.status === "joined", isPending: existing.status === "pending" } });
      }
    } catch (err) {
      next(err);
    }
  });

  // 11. Leave room
  router.post("/:id/leave", authenticateJWT, async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id;

      await roomRepo.deleteMembership(userId, roomId);

      res.json({ success: true, data: { isJoined: false, isPending: false } });
    } catch (err) {
      next(err);
    }
  });

  // 12. Get pending requests (only for creator)
  router.get("/:id/pending-members", authenticateJWT, async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const creatorId = req.user.id;

      const room = await roomRepo.findById(roomId);
      if (!room || room.createdById !== creatorId) {
        res.status(403).json({ success: false, error: "Only the creator can view requests" });
        return;
      }

      const pending = await roomRepo.findPendingMembers(roomId);

      res.json({ success: true, data: pending.map((p) => p.user) });
    } catch (err) {
      next(err);
    }
  });

  // 13. Accept join request (only for creator)
  router.post("/:id/accept-join", authenticateJWT, async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const creatorId = req.user.id;
      const { userId } = req.body;

      const room = await roomRepo.findById(roomId);
      if (!room || room.createdById !== creatorId) {
        res.status(403).json({ success: false, error: "Only the creator can accept requests" });
        return;
      }

      await roomRepo.updateMembershipStatus(userId, roomId, "joined");

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const roomsRouter = createRoomsRouter();
