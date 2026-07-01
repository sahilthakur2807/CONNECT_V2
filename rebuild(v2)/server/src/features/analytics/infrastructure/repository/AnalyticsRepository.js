import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { NotFoundError } from "../../../../shared/errors/AppError.js";

export class AnalyticsRepository {
  /**
   * Aggregates statistics metrics for a specific user profile.
   */
  async findUserStats(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });

    if (!user) throw new NotFoundError("User not found");

    const [messagesSent, communitiesJoined, roomsJoined, friends] =
      await Promise.all([
        prisma.message.count({ where: { userId } }),
        prisma.communityMember.count({ where: { userId, banned: false } }),
        prisma.roomMember.count({ where: { userId } }),
        prisma.friendship.count({
          where: {
            status: "accepted",
            OR: [{ userId }, { friendId: userId }],
          },
        }),
      ]);

    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      messagesSent,
      communitiesJoined,
      roomsJoined,
      friends,
      accountAgeDays,
    };
  }

  /**
   * Aggregates statistics metrics for a specific community.
   */
  async findCommunityStats(communityId) {
    const community = await prisma.community.findFirst({
      where: { id: communityId, deleted: false },
    });

    if (!community) throw new NotFoundError("Community not found");

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [memberCount, activeMembers, roomCount, messagesSent24h] =
      await Promise.all([
        prisma.communityMember.count({ where: { communityId, banned: false } }),
        prisma.communityMember.count({
          where: {
            communityId,
            banned: false,
            user: { status: "online" },
          },
        }),
        prisma.room.count({ where: { communityId, deleted: false } }),
        prisma.message.count({
          where: {
            room: { communityId },
            createdAt: { gt: yesterday },
          },
        }),
      ]);

    return {
      memberCount,
      activeMembers,
      roomCount,
      messagesSent24h,
    };
  }

  /**
   * Aggregates platform-wide engagement metrics for administrative analysis.
   */
  async findPlatformMetrics(startDate, endDate) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [dau, registrations, messageVolume, moderationCount] =
      await Promise.all([
        // Daily Active Users estimated by active online users status
        prisma.user.count({ where: { status: "online" } }),
        prisma.user.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        prisma.message.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
        prisma.moderationAction.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),
      ]);

    return {
      dau,
      registrations,
      messageVolume,
      moderationCount,
    };
  }
}
export const analyticsRepository = new AnalyticsRepository();
