import { activityFeedRepository } from '../../infrastructure/repository/ActivityFeedRepository.js';
import { analyticsRepository } from '../../infrastructure/repository/AnalyticsRepository.js';
import { ForbiddenError } from '../../../../shared/errors/AppError.js';

// --- Queries ---

export class GetUserActivityFeedQuery {
  constructor(
    public readonly userId: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class GetCommunityActivityFeedQuery {
  constructor(
    public readonly communityId: string,
    public readonly limit = 20,
    public readonly cursor?: string
  ) {}
}

export class GetUserStatsQuery {
  constructor(public readonly userId: string) {}
}

export class GetCommunityStatsQuery {
  constructor(public readonly communityId: string) {}
}

export class GetPlatformMetricsQuery {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: string,
    public readonly startDate: Date,
    public readonly endDate: Date
  ) {}
}

// --- Handlers ---

export class GetUserActivityFeedHandler {
  async execute(query: GetUserActivityFeedQuery) {
    return activityFeedRepository.findUserFeed(query.userId, query.limit, query.cursor);
  }
}

export class GetCommunityActivityFeedHandler {
  async execute(query: GetCommunityActivityFeedQuery) {
    return activityFeedRepository.findCommunityFeed(query.communityId, query.limit, query.cursor);
  }
}

export class GetUserStatsHandler {
  async execute(query: GetUserStatsQuery) {
    return analyticsRepository.findUserStats(query.userId);
  }
}

export class GetCommunityStatsHandler {
  async execute(query: GetCommunityStatsQuery) {
    return analyticsRepository.findCommunityStats(query.communityId);
  }
}

export class GetPlatformMetricsHandler {
  async execute(query: GetPlatformMetricsQuery) {
    const isAdmin = query.actorRole === 'admin' || query.actorRole === 'superadmin';
    if (!isAdmin) {
      throw new ForbiddenError('Only site administrators can access platform analytics metrics');
    }
    return analyticsRepository.findPlatformMetrics(query.startDate, query.endDate);
  }
}
