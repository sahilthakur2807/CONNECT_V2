import { prisma } from '@infrastructure/db/PrismaClient.js';

export class GetTrendingMessagesQuery {}

export class GetTrendingMessagesHandler {
  async execute(query: GetTrendingMessagesQuery) {
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: { 
        parentId: null,
        deleted: false,
        createdAt: { gte: last48h }
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        room: { select: { id: true, category: true, title: true } },
        _count: {
          select: { replies: true, reactions: true }
        }
      },
      take: 20
    });

    // Sort by heat score: (replies * 3) + (reactions * 1)
    return messages
      .sort((a, b) => {
        const scoreA = (a._count.replies * 3) + (a._count.reactions);
        const scoreB = (b._count.replies * 3) + (b._count.reactions);
        return scoreB - scoreA;
      })
      .slice(0, 5);
  }
}
