import { activityFeedRepository } from "../../infrastructure/repository/ActivityFeedRepository.js";
import { analyticsRepository } from "../../infrastructure/repository/AnalyticsRepository.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";

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

// --- Handlers ---

export class GetUserActivityFeedHandler {
  async execute(query) {
    return activityFeedRepository.findUserFeed(
      query.userId,
      query.limit,
      query.cursor,
    );
  }
}

export class GetCommunityActivityFeedHandler {
  async execute(query) {
    return activityFeedRepository.findCommunityFeed(
      query.communityId,
      query.limit,
      query.cursor,
    );
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
