import { prisma } from '@infrastructure/db/PrismaClient.js';

export class GetNotificationsQuery {
  constructor(public readonly userId: string) {}
}

export class GetNotificationsHandler {
  async execute(query: GetNotificationsQuery) {
    return prisma.notification.findMany({
      where: { userId: query.userId },
      include: {
        trigger: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
