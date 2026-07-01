import { Router } from "express";
import { z } from "zod";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Handlers
import {
  AwardReputationHandler,
  AwardReputationCommand,
} from "../application/commands/AnalyticsCommands.js";
import {
  GetUserActivityFeedHandler,
  GetCommunityActivityFeedHandler,
  GetUserStatsHandler,
  GetCommunityStatsHandler,
  GetPlatformMetricsHandler,
  GetUserActivityFeedQuery,
  GetCommunityActivityFeedQuery,
  GetUserStatsQuery,
  GetCommunityStatsQuery,
  GetPlatformMetricsQuery,
} from "../application/queries/AnalyticsQueries.js";

const awardReputationHandler = new AwardReputationHandler();
const getUserActivityFeedHandler = new GetUserActivityFeedHandler();
const getCommunityActivityFeedHandler = new GetCommunityActivityFeedHandler();
const getUserStatsHandler = new GetUserStatsHandler();
const getCommunityStatsHandler = new GetCommunityStatsHandler();
const getPlatformMetricsHandler = new GetPlatformMetricsHandler();

export function createAnalyticsRouter() {
  const router = Router();

  // 1. Get User Activity Feed
  router.get("/users/:id/feed", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      limit: z.preprocess(
        (val) => parseInt(val) || 20,
        z.number().min(1).max(100),
      ),
      cursor: z.string().optional(),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetUserActivityFeedQuery(
        req.params.id,
        parsed.limit,
        parsed.cursor,
      );
      const result = await getUserActivityFeedHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 2. Get Community Activity Feed
  router.get(
    "/communities/:id/feed",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        limit: z.preprocess(
          (val) => parseInt(val) || 20,
          z.number().min(1).max(100),
        ),
        cursor: z.string().optional(),
      });

      try {
        const parsed = schema.parse(req.query);
        const query = new GetCommunityActivityFeedQuery(
          req.params.id,
          parsed.limit,
          parsed.cursor,
        );
        const result = await getCommunityActivityFeedHandler.execute(query);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 3. Get User Statistics
  router.get("/users/:id/stats", authenticateJWT, async (req, res, next) => {
    try {
      const query = new GetUserStatsQuery(req.params.id);
      const result = await getUserStatsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 4. Get Community Statistics
  router.get(
    "/communities/:id/stats",
    authenticateJWT,
    async (req, res, next) => {
      try {
        const query = new GetCommunityStatsQuery(req.params.id);
        const result = await getCommunityStatsHandler.execute(query);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  // 5. Get Platform Metrics (Admin Only)
  router.get("/admin/metrics", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      startDate: z.preprocess(
        (val) =>
          val ? new Date(val) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        z.date(),
      ),
      endDate: z.preprocess(
        (val) => (val ? new Date(val) : new Date()),
        z.date(),
      ),
    });

    try {
      const parsed = schema.parse(req.query);
      const query = new GetPlatformMetricsQuery(
        req.user.id,
        req.user.role,
        parsed.startDate,
        parsed.endDate,
      );
      const result = await getPlatformMetricsHandler.execute(query);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  // 6. Award Reputation Point Adjustments (Admin/Mod Only)
  router.post(
    "/moderation/reputation",
    authenticateJWT,
    async (req, res, next) => {
      const schema = z.object({
        targetUserId: z.string().min(1),
        amount: z.number().int(),
        reason: z.string().min(3).max(500),
      });

      try {
        const parsed = schema.parse(req.body);
        const command = new AwardReputationCommand(
          req.user.id,
          req.user.role,
          parsed.targetUserId,
          parsed.amount,
          parsed.reason,
        );
        const result = await awardReputationHandler.execute(command);
        res.json({ success: true, data: result });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
export const analyticsRouter = createAnalyticsRouter();
