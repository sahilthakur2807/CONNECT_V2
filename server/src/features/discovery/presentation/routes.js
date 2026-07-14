import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Search Engine Implementation
import { PrismaSearchEngine } from "../infrastructure/search/PrismaSearchEngine.js";

// Discovery Repository
import { DiscoveryRepository } from "../infrastructure/repository/DiscoveryRepository.js";

// Handlers
import {
  SearchUsersHandler,
  SearchCommunitiesHandler,
  SearchRoomsHandler,
  SearchMessagesHandler,
  GetTrendingContentHandler,
  GetRecommendedCommunitiesHandler,
  SearchUsersQuery,
  SearchCommunitiesQuery,
  SearchRoomsQuery,
  SearchMessagesQuery,
  GetTrendingContentQuery,
  GetRecommendedCommunitiesQuery,
} from "../application/queries/DiscoveryQueries.js";

const searchEngine = new PrismaSearchEngine();
const discoveryRepo = new DiscoveryRepository();

const searchUsersHandler = new SearchUsersHandler(searchEngine);
const searchCommunitiesHandler = new SearchCommunitiesHandler(searchEngine);
const searchRoomsHandler = new SearchRoomsHandler(searchEngine);
const searchMessagesHandler = new SearchMessagesHandler(searchEngine);
const getTrendingContentHandler = new GetTrendingContentHandler(discoveryRepo);
const getRecommendedCommunitiesHandler = new GetRecommendedCommunitiesHandler(
  discoveryRepo,
);

export function createDiscoveryRouter() {
  const router = Router();

  // 1. Search Users
  router.get("/search/users", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      q: z.string().default(""),
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new SearchUsersQuery(parsed.q, parsed.limit, parsed.cursor);
      const result = await searchUsersHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Search Communities
  router.get("/search/communities", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      q: z.string().default(""),
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new SearchCommunitiesQuery(
        parsed.q,
        parsed.limit,
        parsed.cursor,
      );
      const result = await searchCommunitiesHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 3. Search Rooms
  router.get("/search/rooms", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      q: z.string().default(""),
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new SearchRoomsQuery(
        req.user.id,
        parsed.q,
        parsed.limit,
        parsed.cursor,
      );
      const result = await searchRoomsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Search Messages
  router.get("/search/messages", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      q: z.string().min(1),
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new SearchMessagesQuery(
        req.user.id,
        parsed.q,
        parsed.limit,
        parsed.cursor,
      );
      const result = await searchMessagesHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 5. Get Trending Content
  router.get("/discovery/trending", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      limit: z.preprocess(
        (val) => parseInt(val) || 10,
        z.number().min(1).max(100),
      ),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetTrendingContentQuery(parsed.limit);
      const result = await getTrendingContentHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Get Recommended Communities
  router.get(
    "/discovery/recommendations",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        limit: z.preprocess(
          (val) => parseInt(val) || 10,
          z.number().min(1).max(100),
        ),
      });

      try {
        const parsed = schema.parse(req.query);
        const query = new GetRecommendedCommunitiesQuery(
          req.user.id,
          parsed.limit,
        );
        const result = await getRecommendedCommunitiesHandler.execute(query);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
export const discoveryRouter = createDiscoveryRouter();
