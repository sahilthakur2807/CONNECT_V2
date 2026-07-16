import { Router } from "express";
import { z } from "zod";
import {
  authenticateJWT,
  optionalJWT,
} from "../../../presentation/middlewares/AuthMiddleware.js";
import { prisma } from "../../../infrastructure/db/PrismaClient.js";
import { io } from "../../../infrastructure/socket/SocketServer.js";

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
    const includeWorldChat = req.query.includeWorldChat === "true";

    try {
      const query = new GetRoomsQuery(
        communityId,
        category,
        page,
        limit,
        userId,
        includeWorldChat,
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
      const total = await roomRepo.countVisibleRooms(userId);
      res.setHeader("Access-Control-Expose-Headers", "x-total-count");
      res.setHeader("x-total-count", total);
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
      const total = await roomRepo.countVisibleRooms(userId);
      res.setHeader("Access-Control-Expose-Headers", "x-total-count");
      res.setHeader("x-total-count", total);
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
      const total = await roomRepo.countVisibleRooms(userId);
      res.setHeader("Access-Control-Expose-Headers", "x-total-count");
      res.setHeader("x-total-count", total);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // Get active categories (core + promoted hashtags with count > 50)
  router.get("/categories", async (req, res, next) => {
    try {
      const coreCategories = [
        "Politics",
        "Technology",
        "Economy",
        "Environment",
        "World Affairs",
        "Science",
        "Health",
        "Culture",
        "Sports",
      ];

      const hashtags = await prisma.hashtag.findMany({
        include: {
          _count: {
            select: { rooms: true }
          }
        }
      });

      const promoted = hashtags
        .filter((h) => h._count.rooms > 50)
        .map((h) => h.name.charAt(0).toUpperCase() + h.name.slice(1).toLowerCase());

      const allCategories = Array.from(new Set([...coreCategories, ...promoted]));
      res.json({ success: true, data: allCategories });
    } catch (err) {
      next(err);
    }
  });

  // Suggest hashtags based on alphabetical prefix query
  router.get("/hashtags/suggest", async (req, res, next) => {
    const q = req.query.q || "";
    try {
      const prefix = q.trim().replace(/^#/, "").toLowerCase();
      const hashtags = await prisma.hashtag.findMany({
        where: prefix
          ? { name: { startsWith: prefix, mode: "insensitive" } }
          : {},
        select: { name: true },
        take: 10,
        orderBy: { name: "asc" }
      });
      res.json({ success: true, data: hashtags.map(h => h.name) });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Get all rooms with pending rename requests
  router.get("/rename-requests", authenticateJWT, async (req, res, next) => {
    const isPlatformAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isPlatformAdmin) {
      res.status(403).json({ success: false, error: "Only admins can view rename requests" });
      return;
    }

    try {
      const rooms = await prisma.room.findMany({
        where: {
          deleted: false,
          pendingNameRequest: { not: null }
        },
        include: {
          createdBy: {
            select: { id: true, username: true, name: true }
          }
        }
      });
      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Approve room rename request
  router.post("/rename-requests/:id/approve", authenticateJWT, async (req, res, next) => {
    const isPlatformAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isPlatformAdmin) {
      res.status(403).json({ success: false, error: "Only admins can approve rename requests" });
      return;
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id: req.params.id }
      });
      if (!room || room.deleted) {
        res.status(404).json({ success: false, error: "Room not found" });
        return;
      }
      if (!room.pendingNameRequest) {
        res.status(400).json({ success: false, error: "No pending rename request found for this room" });
        return;
      }

      // Check unique title
      const existingRoom = await prisma.room.findFirst({
        where: {
          title: { equals: room.pendingNameRequest, mode: "insensitive" },
          deleted: false
        }
      });
      if (existingRoom) {
        res.status(400).json({ success: false, error: "Room title already exists" });
        return;
      }

      await prisma.room.update({
        where: { id: req.params.id },
        data: {
          title: room.pendingNameRequest,
          pendingNameRequest: null
        }
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Admin: Reject room rename request
  router.post("/rename-requests/:id/reject", authenticateJWT, async (req, res, next) => {
    const isPlatformAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(req.user.role?.toUpperCase());
    if (!isPlatformAdmin) {
      res.status(403).json({ success: false, error: "Only admins can reject rename requests" });
      return;
    }

    try {
      const room = await prisma.room.findUnique({
        where: { id: req.params.id }
      });
      if (!room || room.deleted) {
        res.status(404).json({ success: false, error: "Room not found" });
        return;
      }

      await prisma.room.update({
        where: { id: req.params.id },
        data: {
          pendingNameRequest: null
        }
      });

      res.json({ success: true });
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

  const unescapeUrl = (str) => {
    if (!str) return str;
    return str.replace(/&#x2F;/g, "/");
  };

  // 6. Create room
  router.post("/", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      title: z.string().min(10).max(100),
      description: z.string().max(500),
      category: z.string().min(2).max(30),
      tags: z.array(z.string()).optional().default([]),
      imageUrl: z.string().optional(),
      communityId: z.string().optional(),
      sourceUrl: z.string().url().optional(),
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
        unescapeUrl(parsed.imageUrl),
        req.user.role,
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
      title: z.string().min(10).max(100).optional(),
      description: z.string().max(500).optional(),
      category: z.string().min(2).max(30).optional(),
      tags: z.array(z.string()).optional(),
      imageUrl: z.string().optional(),
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
        unescapeUrl(parsed.imageUrl),
        parsed.isPrivate,
        req.user.role,
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
      const command = new ArchiveRoomCommand(req.user.id, req.user.role, req.params.id);
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

  // 10. Join room / Request access
  router.post("/:id/join", authenticateJWT, async (req, res, next) => {
    try {
      const roomId = req.params.id;
      const userId = req.user.id;

      const room = await roomRepo.findById(roomId);
      if (!room) {
        res.status(404).json({ success: false, error: "Room not found" });
        return;
      }

      const existing = await roomRepo.findMembership(userId, roomId);
      if (!existing) {
        const status = room.isPrivate ? "pending" : "joined";
        await roomRepo.createMembership(userId, roomId, status);

        if (status === "joined") {
          await prisma.activityFeedItem.create({
            data: {
              type: "room.joined",
              userId,
              roomId,
            },
          });
        }

        // Broadcast the updated member count globally
        const memberCount = await prisma.roomMember.count({
          where: { roomId }
        });
        io.emit("room.member.count.updated", { roomId, memberCount });

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

      const room = await roomRepo.findById(roomId);
      if (room && room.createdById === userId) {
        return res.status(400).json({
          success: false,
          error: "You cannot leave a discussion room you created."
        });
      }

      await roomRepo.deleteMembership(userId, roomId);

      // Remove joined room message from activity feed
      await prisma.activityFeedItem.deleteMany({
        where: {
          userId,
          roomId,
          type: "room.joined",
        },
      });

      // Broadcast the updated member count globally
      const memberCount = await prisma.roomMember.count({
        where: { roomId }
      });
      io.emit("room.member.count.updated", { roomId, memberCount });

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

      // Broadcast the updated member count globally
      const memberCount = await prisma.roomMember.count({
        where: { roomId }
      });
      io.emit("room.member.count.updated", { roomId, memberCount });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const roomsRouter = createRoomsRouter();
