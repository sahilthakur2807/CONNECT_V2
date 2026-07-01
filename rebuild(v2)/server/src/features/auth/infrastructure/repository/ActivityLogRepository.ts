import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { ActivityLog, Prisma } from '@prisma/client';

export class ActivityLogRepository extends BaseRepository<
  ActivityLog,
  Prisma.ActivityLogCreateInput,
  Prisma.ActivityLogUpdateInput,
  Prisma.ActivityLogWhereUniqueInput,
  Prisma.ActivityLogWhereInput
> {
  constructor() {
    super(prisma.activityLog, 'activityLog');
  }

  async logAction(userId: string, action: string, details?: string, tx?: any): Promise<ActivityLog> {
    return this.create({
      action,
      details,
      user: { connect: { id: userId } }
    }, tx);
  }
}
export const activityLogRepository = new ActivityLogRepository();
