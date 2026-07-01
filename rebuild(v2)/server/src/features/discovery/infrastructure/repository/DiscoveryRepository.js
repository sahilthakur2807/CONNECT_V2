import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

export class DiscoveryRepository {
  /**
   * Resolves communities with the highest trending scores:
   * Score = (Members * 1.0) + (Messages in last 24h * 3.0)
   */
  async findTrendingCommunities(limit = 10) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const communities = await prisma.community.findMany({
      where: { deleted: false, archived: false },
      include: {
        _count: {
          select: { members: true },
        },
        rooms: {
          where: { deleted: false },
          include: {
            _count: {
              select: {
                messages: {
                  where: {
                    createdAt: { gt: yesterday },
                  },
                },
              },
            },
          },
        },
      },
    });

    const scored = communities.map((comm) => {
      const memberCount = comm._count.members;
      let activityCount = 0;
      for (const room of comm.rooms) {
        activityCount += room._count.messages;
      }
      const score = memberCount * 1.0 + activityCount * 3.0;
      return { comm, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.comm);
  }

  /**
   * Resolves rooms with the highest trending scores:
   * Score = (Members * 1.0) + (Messages in last 24h * 3.0)
   */
  async findTrendingRooms(limit = 10) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rooms = await prisma.room.findMany({
      where: { deleted: false, archived: false },
      include: {
        _count: {
          select: {
            members: true,
            messages: {
              where: { createdAt: { gt: yesterday } },
            },
          },
        },
      },
    });

    const scored = rooms.map((room) => {
      const score = room._count.members * 1.0 + room._count.messages * 3.0;
      return { room, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.room);
  }

  /**
   * Recommends popular communities the user has not yet joined.
   */
  async findRecommendedCommunities(userId, limit = 10) {
    const joined = await prisma.communityMember.findMany({
      where: { userId, banned: false },
      select: { communityId: true },
    });
    const joinedIds = joined.map((m) => m.communityId);

    return prisma.community.findMany({
      where: {
        deleted: false,
        archived: false,
        id: { notIn: joinedIds },
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
      orderBy: {
        members: {
          _count: "desc",
        },
      },
      take: limit,
    });
  }
}
export const discoveryRepository = new DiscoveryRepository();
