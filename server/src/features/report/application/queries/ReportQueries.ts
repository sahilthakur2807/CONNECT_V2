import { prisma } from '@infrastructure/db/PrismaClient.js';
import { UnauthorizedError } from '@shared/errors/AppError.js';

export class GetReportsQuery {
  constructor(
    public readonly userId: string,
    public readonly userRole: string
  ) {}
}

export class GetReportsHandler {
  async execute(query: GetReportsQuery) {
    const isAdminOrSuperAdmin = query.userRole === 'admin' || query.userRole === 'superadmin';
    const isCommonModerator = query.userRole === 'moderator';

    let whereClause: any = {};
    
    if (!isAdminOrSuperAdmin && !isCommonModerator) {
      // Find rooms created by the user
      const createdRooms = await prisma.room.findMany({
        where: { createdById: query.userId },
        select: { id: true }
      });
      const createdRoomIds = createdRooms.map(r => r.id);
      
      if (createdRoomIds.length === 0) {
        throw new UnauthorizedError('Access denied');
      }
      
      whereClause = {
        OR: [
          { roomId: { in: createdRoomIds } },
          { message: { roomId: { in: createdRoomIds } } }
        ]
      };
    }

    return prisma.report.findMany({
      where: whereClause,
      include: {
        reporter: { select: { id: true, username: true, name: true } },
        reportedUser: { select: { id: true, username: true, name: true } },
        message: true,
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
