import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GetUserCategoryContributionsHandler,
  GetUserCategoryContributionsQuery,
  getCategoryRankInfo,
} from "../src/features/analytics/application/queries/AnalyticsQueries.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

// Mock Prisma client
vi.mock("../src/infrastructure/db/PrismaClient.js", () => ({
  prisma: {
    message: {
      findMany: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
    reaction: {
      findMany: vi.fn(),
    },
  },
}));

describe("Category Rank Logic Unit Tests", () => {
  describe("getCategoryRankInfo math", () => {
    it("should return Unranked for 0 EXP", () => {
      const info = getCategoryRankInfo(0);
      expect(info.rank).toBe("Unranked");
      expect(info.medal).toBeNull();
      expect(info.currentExp).toBe(0);
      expect(info.percentage).toBe(0);
      expect(info.nextThreshold).toBe(1);
    });

    it("should return Newcomer for 15 EXP", () => {
      const info = getCategoryRankInfo(15);
      expect(info.rank).toBe("Newcomer");
      expect(info.medal).toBeNull();
      expect(info.currentExp).toBe(15);
      expect(info.percentage).toBe(29); // (15-1) / 49 * 100
      expect(info.nextThreshold).toBe(50);
    });

    it("should return Contributor for 80 EXP", () => {
      const info = getCategoryRankInfo(80);
      expect(info.rank).toBe("Contributor");
      expect(info.medal).toBe("bronze1");
      expect(info.currentExp).toBe(80);
      expect(info.percentage).toBe(60); // (80-50) / 50 * 100
      expect(info.nextThreshold).toBe(100);
    });

    it("should return Active Contributor for 120 EXP", () => {
      const info = getCategoryRankInfo(120);
      expect(info.rank).toBe("Active Contributor");
      expect(info.medal).toBe("bronze2");
      expect(info.currentExp).toBe(120);
      expect(info.percentage).toBe(20); // (120-100) / 100 * 100
      expect(info.nextThreshold).toBe(200);
    });

    it("should return Senior Contributor for 250 EXP", () => {
      const info = getCategoryRankInfo(250);
      expect(info.rank).toBe("Senior Contributor");
      expect(info.medal).toBe("bronze3");
      expect(info.currentExp).toBe(250);
      expect(info.percentage).toBe(50); // (250-200) / 100 * 100
      expect(info.nextThreshold).toBe(300);
    });

    it("should return Analyst for 360 EXP", () => {
      const info = getCategoryRankInfo(360);
      expect(info.rank).toBe("Analyst");
      expect(info.medal).toBe("silver1");
      expect(info.currentExp).toBe(360);
      expect(info.percentage).toBe(40); // (360-300) / 150 * 100
      expect(info.nextThreshold).toBe(450);
    });

    it("should return Visionary for 2500 EXP", () => {
      const info = getCategoryRankInfo(2500);
      expect(info.rank).toBe("Visionary");
      expect(info.medal).toBe("diamondPlus");
      expect(info.currentExp).toBe(2500);
      expect(info.percentage).toBe(100);
      expect(info.nextThreshold).toBeNull();
    });
  });

  describe("GetUserCategoryContributionsHandler execution", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("should group user contributions by category and calculate correct EXP", async () => {
      const handler = new GetUserCategoryContributionsHandler();
      const query = new GetUserCategoryContributionsQuery("usr_test_999");

      // Mock user messages (each = 15 EXP)
      // Politics: 2 messages => 30 EXP
      // Technology: 1 message => 15 EXP
      prisma.message.findMany.mockResolvedValue([
        { room: { category: "Politics" } },
        { room: { category: "Politics" } },
        { room: { category: "Technology" } },
      ]);

      // Mock user created rooms (each = 50 EXP)
      // Technology: 1 room => 50 EXP
      prisma.room.findMany.mockResolvedValue([
        { category: "Technology" },
      ]);

      // Mock user received reactions (each = 15 EXP)
      prisma.reaction.findMany.mockResolvedValue([]);

      const result = await handler.execute(query);

      // We expect the result sorted by EXP descending.
      // Technology: 1 msg (15) + 1 room (50) = 65 EXP -> rank Contributor
      // Politics: 2 msg (30) + 0 room (0) = 30 EXP -> rank Newcomer
      // Economy, Environment, World Affairs, etc. have 0 EXP -> Unranked

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(9);

      // Verify Technology is first (65 EXP > 30 EXP)
      expect(result[0].category).toBe("Technology");
      expect(result[0].currentExp).toBe(65);
      expect(result[0].messageCount).toBe(1);
      expect(result[0].roomsCreatedCount).toBe(1);
      expect(result[0].rank).toBe("Contributor");

      // Verify Politics is second (30 EXP)
      expect(result[1].category).toBe("Politics");
      expect(result[1].currentExp).toBe(30);
      expect(result[1].messageCount).toBe(2);
      expect(result[1].roomsCreatedCount).toBe(0);
      expect(result[1].rank).toBe("Newcomer");

      // Verify others are unranked/0
      const unrankedTopics = result.slice(2);
      unrankedTopics.forEach((topic) => {
        expect(topic.currentExp).toBe(0);
        expect(topic.rank).toBe("Unranked");
      });
    });

    it("should return empty stats/unranked categories when user has no messages or rooms", async () => {
      const handler = new GetUserCategoryContributionsHandler();
      const query = new GetUserCategoryContributionsQuery("usr_empty");

      prisma.message.findMany.mockResolvedValue([]);
      prisma.room.findMany.mockResolvedValue([]);
      prisma.reaction.findMany.mockResolvedValue([]);

      const result = await handler.execute(query);

      expect(result).toHaveLength(9);
      result.forEach((topic) => {
        expect(topic.currentExp).toBe(0);
        expect(topic.rank).toBe("Unranked");
        expect(topic.medal).toBeNull();
      });
    });
  });
});
