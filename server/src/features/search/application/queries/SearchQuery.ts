import { prisma } from '@infrastructure/db/PrismaClient.js';

export class SearchQuery {
  constructor(public readonly queryText: string) {}
}

export class SearchQueryHandler {
  async execute(query: SearchQuery) {
    const q = query.queryText;
    if (!q) {
      return { rooms: [], users: [], messages: [] };
    }

    const [rooms, users, messages] = await Promise.all([
      prisma.room.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
          community: true,
          _count: { select: { members: true, messages: true } }
        },
        take: 10
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          verified: true,
          reputation: true,
          badges: true
        },
        take: 10
      }),
      prisma.message.findMany({
        where: {
          content: { contains: q, mode: 'insensitive' },
          deleted: false
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true }
          },
          room: true
        },
        take: 10
      })
    ]);

    return { rooms, users, messages };
  }
}
