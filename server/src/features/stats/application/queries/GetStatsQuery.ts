import { prisma } from '@infrastructure/db/PrismaClient.js';

export class GetStatsQuery {}

export class GetStatsQueryHandler {
  async execute(query: GetStatsQuery) {
    const [totalUsers, totalRooms, totalMessages, totalCommunities, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.room.count(),
      prisma.message.count({ where: { deleted: false } }),
      prisma.community.count(),
      prisma.user.count({ where: { status: 'online' } })
    ]);

    // Generate last 7 days chart data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0,0,0,0));
      const endOfDay = new Date(date.setHours(23,59,59,999));
      
      const [dayMessages, dayUsers] = await Promise.all([
        prisma.message.count({
          where: { createdAt: { gte: startOfDay, lte: endOfDay }, deleted: false }
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfDay, lte: endOfDay } }
        })
      ]);
      
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      chartData.push({
        day: days[startOfDay.getDay()],
        messages: dayMessages,
        users: dayUsers
      });
    }

    return {
      totalUsers,
      totalRooms,
      totalMessages,
      totalCommunities,
      activeUsers,
      chartData
    };
  }
}
