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

    const [messagesSent, nonWorldChatMessagesSent, communitiesJoined, roomsJoined, roomsCreated, friends, sessions] =
      await Promise.all([
        prisma.message.count({ where: { userId } }),
        prisma.message.count({
          where: {
            userId,
            room: {
              title: { not: "World Chat" }
            }
          }
        }),
        prisma.communityMember.count({ where: { userId, banned: false } }),
        prisma.roomMember.count({ where: { userId } }),
        prisma.room.count({ where: { createdById: userId, deleted: false } }),
        prisma.friendship.count({
          where: {
            status: "accepted",
            OR: [{ userId }, { friendId: userId }],
          },
        }),
        prisma.session.findMany({
          where: { userId },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" }
        })
      ]);

    const accountAgeDays = Math.floor(
      (Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Calculate login streak based on session createdAt dates
    const uniqueDays = Array.from(new Set(sessions.map(s => {
      const d = new Date(s.createdAt);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })));

    let streak = 0;
    if (uniqueDays.length > 0) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const yesterdayStr = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

      if (uniqueDays.includes(todayStr) || uniqueDays.includes(yesterdayStr)) {
        streak = 1;
        let checkDate = uniqueDays.includes(todayStr) ? today : yesterday;
        while (true) {
          const nextCheckDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
          const nextCheckStr = `${nextCheckDate.getFullYear()}-${nextCheckDate.getMonth()}-${nextCheckDate.getDate()}`;
          if (uniqueDays.includes(nextCheckStr)) {
            streak++;
            checkDate = nextCheckDate;
          } else {
            break;
          }
        }
      }
    }

    return {
      messagesSent,
      nonWorldChatMessagesSent,
      communitiesJoined,
      roomsJoined,
      roomsCreated,
      friends,
      streak,
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
