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
