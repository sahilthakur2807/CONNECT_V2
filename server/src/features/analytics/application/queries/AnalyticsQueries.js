import { activityFeedRepository } from "../../infrastructure/repository/ActivityFeedRepository.js";
import { analyticsRepository } from "../../infrastructure/repository/AnalyticsRepository.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Queries ---

export class GetUserActivityFeedQuery {
  constructor(userId, limit = 20, cursor) {
    this.userId = userId;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class GetCommunityActivityFeedQuery {
  constructor(communityId, limit = 20, cursor) {
    this.communityId = communityId;
    this.limit = limit;
    this.cursor = cursor;
  }
}

export class GetUserStatsQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

export class GetCommunityStatsQuery {
  constructor(communityId) {
    this.communityId = communityId;
  }
}

export class GetPlatformMetricsQuery {
  constructor(actorId, actorRole, startDate, endDate) {
    this.actorId = actorId;
    this.actorRole = actorRole;
    this.startDate = startDate;
    this.endDate = endDate;
  }
}

export class GetUserMonthlyContributionsQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

// --- Handlers ---

export class GetUserActivityFeedHandler {
  async execute(query) {
    // 1. Fetch non-message activities
    const items = await prisma.activityFeedItem.findMany({
      where: {
        userId: query.userId,
        type: { not: "message.posted" }
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        community: { select: { id: true, name: true } },
        room: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit
    });

    // 2. Fetch top 5 takes with reactions
    const topTakes = await prisma.message.findMany({
      where: {
        userId: query.userId,
        deleted: false,
        reactions: {
          some: {} // has at least one reaction
        }
      },
      include: {
        reactions: true,
        room: { select: { id: true, title: true } },
        user: { select: { id: true, username: true, name: true, avatar: true } }
      },
      orderBy: {
        reactions: {
          _count: "desc"
        }
      },
      take: 5
    });

    // Map top takes to feed items structure
    const topTakeFeedItems = topTakes.map(msg => ({
      id: msg.id,
      type: "top.take",
      userId: msg.userId,
      user: msg.user,
      roomId: msg.roomId,
      room: msg.room,
      metadata: JSON.stringify({ messageId: msg.id, reactionCount: msg.reactions.length }),
      createdAt: msg.createdAt,
      description: `Shared a top take in room "${msg.room?.title || 'Unknown'}": "${msg.content.length > 80 ? msg.content.substring(0, 80) + '...' : msg.content}" (${msg.reactions.length} reactions)`
    }));

    // 3. Format other activities
    const mappedItems = items.map(item => {
      let description = "";
      switch (item.type) {
        case "user.registered":
          description = "Registered a new account.";
          break;
        case "community.created":
          description = `Created community "${item.community?.name || 'Unknown'}".`;
          break;
        case "community.joined":
          description = `Joined community "${item.community?.name || 'Unknown'}".`;
          break;
        case "room.created":
          description = `Created room "${item.room?.title || 'Unknown'}".`;
          break;
        case "room.joined":
          description = `Joined room "${item.room?.title || 'Unknown'}".`;
          break;
        case "friend.accepted":
          description = "Became friends with a citizen.";
          break;
        default:
          description = `Performed action: ${item.type}`;
      }
      return {
        ...item,
        description
      };
    });

    // 4. Combine and sort
    const combined = [...mappedItems, ...topTakeFeedItems];
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return combined.slice(0, query.limit);
  }
}

export class GetCommunityActivityFeedHandler {
  async execute(query) {
    const items = await activityFeedRepository.findCommunityFeed(
      query.communityId,
      query.limit,
      query.cursor,
    );
    return items.map(item => {
      let description = "";
      switch (item.type) {
        case "community.created":
          description = `Community "${item.community?.name || 'Unknown'}" was created.`;
          break;
        case "community.joined":
          description = `@${item.user?.username || 'user'} joined the community.`;
          break;
        case "room.created":
          description = `Room "${item.room?.title || 'Unknown'}" was created.`;
          break;
        case "message.posted":
          description = `@${item.user?.username || 'user'} posted a take in room "${item.room?.title || 'Unknown'}".`;
          break;
        default:
          description = `Action: ${item.type}`;
      }
      return {
        ...item,
        description
      };
    });
  }
}

export class GetUserStatsHandler {
  async execute(query) {
    return analyticsRepository.findUserStats(query.userId);
  }
}

export class GetCommunityStatsHandler {
  async execute(query) {
    return analyticsRepository.findCommunityStats(query.communityId);
  }
}

export class GetPlatformMetricsHandler {
  async execute(query) {
    const isAdmin =
      query.actorRole === "admin" || query.actorRole === "superadmin";
    if (!isAdmin) {
      throw new ForbiddenError(
        "Only site administrators can access platform analytics metrics",
      );
    }
    return analyticsRepository.findPlatformMetrics(
      query.startDate,
      query.endDate,
    );
  }
}

export class GetUserMonthlyContributionsHandler {
  async execute(query) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const contributions = await prisma.message.groupBy({
      by: ["roomId"],
      where: {
        userId: query.userId,
        deleted: false,
        createdAt: {
          gte: startOfMonth,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 10,
    });

    const roomIds = contributions.map((c) => c.roomId);
    const rooms = await prisma.room.findMany({
      where: { id: { in: roomIds } },
      select: { id: true, title: true },
    });

    const roomMap = new Map(rooms.map((r) => [r.id, r.title]));
    const totalMessages = contributions.reduce((sum, c) => sum + c._count.id, 0);

    return contributions.map((c) => ({
      roomId: c.roomId,
      roomTitle: roomMap.get(c.roomId) || "Unknown Room",
      messageCount: c._count.id,
      percentage: totalMessages > 0 ? parseFloat(((c._count.id / totalMessages) * 100).toFixed(1)) : 0,
    }));
  }
}

export function getCategoryRankInfo(exp) {
  if (exp <= 0) {
    return {
      rank: "Unranked",
      medal: null,
      currentExp: 0,
      nextThreshold: 1,
      prevThreshold: 0,
      tierProgress: 0,
      tierRequired: 1,
      percentage: 0,
      level: 0,
    };
  }

  const levels = [
    { level: 1, min: 1, max: 50, rank: "Newcomer", medal: null },
    { level: 2, min: 50, max: 100, rank: "Contributor", medal: "bronze1" },
    { level: 3, min: 100, max: 200, rank: "Active Contributor", medal: "bronze2" },
    { level: 4, min: 200, max: 300, rank: "Senior Contributor", medal: "bronze3" },
    { level: 5, min: 300, max: 450, rank: "Analyst", medal: "silver1" },
    { level: 6, min: 450, max: 600, rank: "Senior Analyst", medal: "silver2" },
    { level: 7, min: 600, max: 750, rank: "Specialist", medal: "silver3" },
    { level: 8, min: 750, max: 900, rank: "Expert", medal: "gold1" },
    { level: 9, min: 900, max: 1050, rank: "Senior Expert", medal: "gold2" },
    { level: 10, min: 1050, max: 1200, rank: "Authority", medal: "gold3" },
    { level: 11, min: 1200, max: 1350, rank: "Distinguished Authority", medal: "platinum1" },
    { level: 12, min: 1350, max: 1500, rank: "Thought Leader", medal: "platinum2" },
    { level: 13, min: 1500, max: 2000, rank: "Community Icon", medal: "diamond" },
    { level: 14, min: 2000, max: Infinity, rank: "Visionary", medal: "diamondPlus" },
  ];

  const currentTier = levels.find(l => exp >= l.min && exp < l.max) || levels[levels.length - 1];

  const isMax = currentTier.max === Infinity;
  const min = currentTier.min;
  const max = isMax ? null : currentTier.max;
  const tierProgress = exp - min;
  const tierRequired = isMax ? null : (max - min);
  const percentage = isMax ? 100 : Math.min(100, Math.max(0, Math.round((tierProgress / tierRequired) * 100)));

  return {
    rank: currentTier.rank,
    medal: currentTier.medal,
    currentExp: exp,
    nextThreshold: max,
    prevThreshold: min,
    tierProgress,
    tierRequired,
    percentage,
    level: currentTier.level,
  };
}

export class GetUserCategoryContributionsQuery {
  constructor(userId) {
    this.userId = userId;
  }
}

export class GetUserCategoryContributionsHandler {
  async execute(query) {
    // 1. Fetch rooms created by the user (each = 50 EXP)
    const roomsCreated = await prisma.room.findMany({
      where: {
        createdById: query.userId,
        deleted: false,
      },
      select: {
        category: true,
      },
    });

    // 2. Fetch replies received by the user (excluding self-replies, each = 15 EXP)
    const repliesReceived = await prisma.message.findMany({
      where: {
        parentId: { not: null },
        deleted: false,
        parent: {
          userId: query.userId,
          deleted: false,
        },
        room: {
          deleted: false,
        },
        userId: { not: query.userId }, // exclude self-replies
      },
      select: {
        room: {
          select: {
            category: true,
          },
        },
      },
    });

    // 3. Fetch reactions received by the user (excluding self-reactions, each = 15 EXP)
    const reactionsReceived = await prisma.reaction.findMany({
      where: {
        message: {
          userId: query.userId,
          deleted: false,
          room: {
            deleted: false,
          },
        },
        userId: { not: query.userId }, // exclude self-reactions
      },
      select: {
        message: {
          select: {
            room: {
              select: {
                category: true,
              },
            },
          },
        },
      },
    });

    // 4. Define the core categories list
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

    // Initialize category statistics maps
    const categoryStats = {};
    for (const cat of coreCategories) {
      categoryStats[cat] = {
        repliesReceivedCount: 0,
        reactionsReceivedCount: 0,
        roomsCreatedCount: 0,
      };
    }

    const findCanonicalCategory = (name) => {
      return coreCategories.find(c => c.toLowerCase() === name.toLowerCase()) || name;
    };

    // Populate counts from rooms created
    for (const room of roomsCreated) {
      if (room.category) {
        const canonical = findCanonicalCategory(room.category);
        if (!categoryStats[canonical]) {
          categoryStats[canonical] = { repliesReceivedCount: 0, reactionsReceivedCount: 0, roomsCreatedCount: 0 };
        }
        categoryStats[canonical].roomsCreatedCount += 1;
      }
    }

    // Populate counts from replies received
    for (const reply of repliesReceived) {
      if (reply.room && reply.room.category) {
        const canonical = findCanonicalCategory(reply.room.category);
        if (!categoryStats[canonical]) {
          categoryStats[canonical] = { repliesReceivedCount: 0, reactionsReceivedCount: 0, roomsCreatedCount: 0 };
        }
        categoryStats[canonical].repliesReceivedCount += 1;
      }
    }

    // Populate counts from reactions received
    for (const reaction of reactionsReceived) {
      if (reaction.message && reaction.message.room && reaction.message.room.category) {
        const canonical = findCanonicalCategory(reaction.message.room.category);
        if (!categoryStats[canonical]) {
          categoryStats[canonical] = { repliesReceivedCount: 0, reactionsReceivedCount: 0, roomsCreatedCount: 0 };
        }
        categoryStats[canonical].reactionsReceivedCount += 1;
      }
    }

    // 5. Calculate EXP and rank info for each category
    const result = Object.entries(categoryStats).map(([category, stats]) => {
      const exp = (stats.repliesReceivedCount + stats.reactionsReceivedCount) * 15 + stats.roomsCreatedCount * 50;
      const rankInfo = getCategoryRankInfo(exp);
      return {
        category,
        messageCount: stats.repliesReceivedCount, // mapped to replies received for UI compatibility
        roomsCreatedCount: stats.roomsCreatedCount,
        repliesReceivedCount: stats.repliesReceivedCount,
        reactionsReceivedCount: stats.reactionsReceivedCount,
        ...rankInfo,
      };
    });

    // 5. Sort by EXP descending
    result.sort((a, b) => b.currentExp - a.currentExp);

    return result;
  }
}

