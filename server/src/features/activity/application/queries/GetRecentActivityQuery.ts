import { prisma } from '@infrastructure/db/PrismaClient.js';

export class GetRecentActivityQuery {}

export class GetRecentActivityHandler {
  async execute(query: GetRecentActivityQuery) {
    return prisma.activity.findMany({
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        room: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }
}
