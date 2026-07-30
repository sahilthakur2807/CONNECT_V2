import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerAnalyticsSubscribers } from "../src/features/analytics/infrastructure/events/AnalyticsEventSubscribers.js";
import {
  AwardReputationHandler,
  AwardReputationCommand,
} from "../src/features/analytics/application/commands/AnalyticsCommands.js";
import {
  GetUserStatsHandler,
  GetUserStatsQuery,
  GetPlatformMetricsHandler,
  GetPlatformMetricsQuery,
} from "../src/features/analytics/application/queries/AnalyticsQueries.js";
import { activityFeedRepository } from "../src/features/analytics/infrastructure/repository/ActivityFeedRepository.js";
import { reputationLogRepository } from "../src/features/analytics/infrastructure/repository/ReputationLogRepository.js";
import { analyticsRepository } from "../src/features/analytics/infrastructure/repository/AnalyticsRepository.js";
import { EventBus } from "../src/shared/event-bus/EventBus.js";
import { ForbiddenError } from "../src/shared/errors/AppError.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

// Mock repositories
vi.mock(
  "../src/features/analytics/infrastructure/repository/ActivityFeedRepository.js",
  () => ({
    activityFeedRepository: {
      create: vi.fn(),
    },
  }),
);

vi.mock(
  "../src/features/analytics/infrastructure/repository/ReputationLogRepository.js",
  () => ({
    reputationLogRepository: {
      logAward: vi.fn(),
    },
  }),
);

vi.mock(
  "../src/features/analytics/infrastructure/repository/AnalyticsRepository.js",
  () => ({
    analyticsRepository: {
      findUserStats: vi.fn(),
      findCommunityStats: vi.fn(),
      findPlatformMetrics: vi.fn(),
    },
  }),
);

// Mock Prisma
vi.mock("../src/infrastructure/db/PrismaClient.js", () => ({
  prisma: {
    room: {
      findUnique: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
    },
  },
}));

describe("CONNECT Phase 8 Analytics & Reputation Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Asynchronous subscriber hook testing
  describe("AnalyticsEventSubscribers", () => {
    it("should log community creation activity and allocate 50 reputation points", async () => {
      registerAnalyticsSubscribers();

      // Trigger the event
      await EventBus.publish({
        eventName: "community.created",
        occurredAt: new Date(),
        communityId: "comm_123",
        ownerId: "usr_creator",
      });

      expect(activityFeedRepository.create).toHaveBeenCalledWith({
        type: "community.created",
        user: { connect: { id: "usr_creator" } },
        community: { connect: { id: "comm_123" } },
      });

      expect(reputationLogRepository.logAward).toHaveBeenCalledWith(
        "usr_creator",
        50,
        "community.created",
      );
    });

    it("should log message posted and not award message reputation points", async () => {
      registerAnalyticsSubscribers();

      vi.mocked(prisma.message.findUnique).mockResolvedValue({
        id: "msg_123",
        userId: "usr_poster",
        roomId: "rm_123",
        room: { communityId: "comm_123" },
      });

      await EventBus.publish({
        eventName: "message.created",
        occurredAt: new Date(),
        messageId: "msg_123",
        roomId: "rm_123",
      });

      expect(prisma.message.findUnique).toHaveBeenCalledWith({
        where: { id: "msg_123" },
        include: { room: true },
      });

      expect(activityFeedRepository.create).toHaveBeenCalledWith({
        type: "message.posted",
        user: { connect: { id: "usr_poster" } },
        room: { connect: { id: "rm_123" } },
        community: { connect: { id: "comm_123" } },
        metadata: JSON.stringify({ messageId: "msg_123" }),
      });

      expect(reputationLogRepository.logAward).not.toHaveBeenCalled();
    });
  });

  // 2. Command handlers (Award manual reputation)
  describe("AwardReputationHandler", () => {
    it("should allow admins to manual adjust points and publish event", async () => {
      const handler = new AwardReputationHandler();
      const command = new AwardReputationCommand(
        "usr_admin",
        "admin",
        "usr_target",
        30,
        "Helpful contributions",
      );

      await handler.execute(command);

      expect(reputationLogRepository.logAward).toHaveBeenCalledWith(
        "usr_target",
        30,
        "manual: Helpful contributions",
      );
    });

    it("should block non-moderators from awarding reputation points", async () => {
      const handler = new AwardReputationHandler();
      const command = new AwardReputationCommand(
        "usr_member",
        "user",
        "usr_target",
        30,
        "Self reward",
      );

      await expect(handler.execute(command)).rejects.toThrow(ForbiddenError);
    });
  });

  // 3. User Statistics Queries
  describe("GetUserStatsHandler", () => {
    it("should retrieve user statistics metrics", async () => {
      const handler = new GetUserStatsHandler();
      const query = new GetUserStatsQuery("usr_target");

      vi.mocked(analyticsRepository.findUserStats).mockResolvedValue({
        messagesSent: 42,
        communitiesJoined: 3,
      });

      const result = await handler.execute(query);

      expect(analyticsRepository.findUserStats).toHaveBeenCalledWith(
        "usr_target",
      );
      expect(result.messagesSent).toBe(42);
    });
  });

  // 4. Platform Metrics permissions checking
  describe("GetPlatformMetricsHandler", () => {
    it("should reject metrics requests from non-admins", async () => {
      const handler = new GetPlatformMetricsHandler();
      const query = new GetPlatformMetricsQuery(
        "usr_member",
        "user",
        new Date(),
        new Date(),
      );

      await expect(handler.execute(query)).rejects.toThrow(ForbiddenError);
    });

    it("should allow platform metrics queries to site admins", async () => {
      const handler = new GetPlatformMetricsHandler();
      const query = new GetPlatformMetricsQuery(
        "usr_admin",
        "admin",
        new Date(),
        new Date(),
      );

      vi.mocked(analyticsRepository.findPlatformMetrics).mockResolvedValue({
        dau: 100,
      });

      const result = await handler.execute(query);

      expect(result.dau).toBe(100);
    });
  });
});
