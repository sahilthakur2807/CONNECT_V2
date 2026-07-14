import { describe, it, expect, vi, beforeEach } from "vitest";
import { GetUserMonthlyContributionsHandler, GetUserMonthlyContributionsQuery } from "../src/features/analytics/application/queries/AnalyticsQueries.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

// Mock Prisma
vi.mock("../src/infrastructure/db/PrismaClient.js", () => ({
  prisma: {
    message: {
      groupBy: vi.fn(),
    },
    room: {
      findMany: vi.fn(),
    },
  },
}));

describe("GetUserMonthlyContributionsHandler Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return monthly contribution stats aggregated and sorted by messageCount descending", async () => {
    const handler = new GetUserMonthlyContributionsHandler();
    const query = new GetUserMonthlyContributionsQuery("usr_test_123");

    // Mock message.groupBy output
    prisma.message.groupBy.mockResolvedValue([
      { roomId: "room_1", _count: { id: 15 } },
      { roomId: "room_2", _count: { id: 5 } },
    ]);

    // Mock room.findMany output
    prisma.room.findMany.mockResolvedValue([
      { id: "room_1", title: "General Room" },
      { id: "room_2", title: "Tech Room" },
    ]);

    const result = await handler.execute(query);

    expect(prisma.message.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["roomId"],
        where: expect.objectContaining({
          userId: "usr_test_123",
          deleted: false,
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: "desc",
          },
        },
        take: 10,
      })
    );

    expect(prisma.room.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["room_1", "room_2"] },
      },
      select: {
        id: true,
        title: true,
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      roomId: "room_1",
      roomTitle: "General Room",
      messageCount: 15,
      percentage: 75.0,
    });
    expect(result[1]).toEqual({
      roomId: "room_2",
      roomTitle: "Tech Room",
      messageCount: 5,
      percentage: 25.0,
    });
  });

  it("should handle empty contributions array gracefully", async () => {
    const handler = new GetUserMonthlyContributionsHandler();
    const query = new GetUserMonthlyContributionsQuery("usr_test_123");

    prisma.message.groupBy.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([]);

    const result = await handler.execute(query);

    expect(result).toHaveLength(0);
  });
});
