import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Repositories
import { CommunityRepository } from "../infrastructure/repository/CommunityRepository.js";
import { CommunityMembershipRepository } from "../infrastructure/repository/CommunityMembershipRepository.js";

// Handlers
import {
  CreateCommunityCommand,
  CreateCommunityHandler,
  UpdateCommunityCommand,
  UpdateCommunityHandler,
  ArchiveCommunityCommand,
  ArchiveCommunityHandler,
  DeleteCommunityCommand,
  DeleteCommunityHandler,
  TransferOwnershipCommand,
  TransferOwnershipHandler,
  JoinCommunityCommand,
  JoinCommunityHandler,
  LeaveCommunityCommand,
  LeaveCommunityHandler,
} from "../application/commands/CommunityCommands.js";
import {
  GetCommunitiesQuery,
  GetCommunitiesHandler,
  GetCommunityByIdQuery,
  GetCommunityByIdHandler,
  GetCommunityMembersQuery,
  GetCommunityMembersHandler,
} from "../application/queries/CommunityQueries.js";

const communityRepo = new CommunityRepository();
const membershipRepo = new CommunityMembershipRepository();

const createCommunityHandler = new CreateCommunityHandler(
  communityRepo,
  membershipRepo,
);
const updateCommunityHandler = new UpdateCommunityHandler(
  communityRepo,
  membershipRepo,
);
const archiveCommunityHandler = new ArchiveCommunityHandler(communityRepo);
const deleteCommunityHandler = new DeleteCommunityHandler(communityRepo);
const transferOwnershipHandler = new TransferOwnershipHandler(
  communityRepo,
  membershipRepo,
);
const joinCommunityHandler = new JoinCommunityHandler(
  communityRepo,
  membershipRepo,
);
const leaveCommunityHandler = new LeaveCommunityHandler(
  communityRepo,
  membershipRepo,
);

const getCommunitiesHandler = new GetCommunitiesHandler(communityRepo);
const getCommunityByIdHandler = new GetCommunityByIdHandler(communityRepo);
const getCommunityMembersHandler = new GetCommunityMembersHandler(
  membershipRepo,
);

export function createCommunitiesRouter() {
  const router = Router();

  // 1. Get all communities
  router.get("/", async (req, res, next) => {
    try {
      const query = new GetCommunitiesQuery();
      const result = await getCommunitiesHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Get community by ID
  router.get("/:id", async (req, res, next) => {
    try {
      const query = new GetCommunityByIdQuery(req.params.id);
      const result = await getCommunityByIdHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 3. Create community
  router.post("/", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      name: z
        .string()
        .min(3)
        .max(50)
        .regex(
          /^[a-zA-Z0-9_\-\s]+$/,
          "Name can only contain letters, numbers, spaces, dashes, and underscores",
        ),
      description: z.string().min(10).max(1000),
      category: z.string().min(2).max(30).default("General"),
      imageUrl: z.string().url().optional(),
      banner: z.string().url().optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new CreateCommunityCommand(
        req.user.id,
        parsed.name,
        parsed.description,
        parsed.category,
        parsed.imageUrl,
        parsed.banner,
      );
      const result = await createCommunityHandler.execute(command);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Update community
  router.patch("/:id", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      description: z.string().min(10).max(1000).optional(),
      imageUrl: z.string().url().optional(),
      banner: z.string().url().optional(),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new UpdateCommunityCommand(
        req.user.id,
        req.params.id,
        parsed.description,
        parsed.imageUrl,
        parsed.banner,
      );
      const result = await updateCommunityHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 5. Archive community
  router.post("/:id/archive", authenticateJWT, async (req, res, next) => {
    try {
      const command = new ArchiveCommunityCommand(req.user.id, req.params.id);
      const result = await archiveCommunityHandler.execute(command);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Delete community (soft delete)
  router.delete("/:id", authenticateJWT, async (req, res, next) => {
    try {
      const command = new DeleteCommunityCommand(
        req.params.id,
        req.user.id,
        req.user.role,
      );
      await deleteCommunityHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 7. Join community
  router.post("/:id/join", authenticateJWT, async (req, res, next) => {
    try {
      const command = new JoinCommunityCommand(req.user.id, req.params.id);
      await joinCommunityHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 8. Leave community
  router.post("/:id/leave", authenticateJWT, async (req, res, next) => {
    try {
      const command = new LeaveCommunityCommand(req.user.id, req.params.id);
      await leaveCommunityHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 9. Transfer ownership
  router.post("/:id/transfer", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      targetUserId: z.string().min(1),
    });

    try {
      const parsed = schema.parse(req.body);
      const command = new TransferOwnershipCommand(
        req.user.id,
        req.params.id,
        parsed.targetUserId,
      );
      await transferOwnershipHandler.execute(command);
      res.json({ success: true, data: null });
    } catch (err) {
      next(err);
    }
  });

  // 10. Get community members
  router.get("/:id/members", async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    try {
      const query = new GetCommunityMembersQuery(req.params.id, page, limit);
      const result = await getCommunityMembersHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
export const communitiesRouter = createCommunitiesRouter();
