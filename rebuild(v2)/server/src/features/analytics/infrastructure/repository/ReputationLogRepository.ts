import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { ReputationLog, Prisma } from '@prisma/client';

export class ReputationLogRepository extends BaseRepository<
  ReputationLog,
  Prisma.ReputationLogCreateInput,
  Prisma.ReputationLogUpdateInput,
  Prisma.ReputationLogWhereUniqueInput,
  Prisma.ReputationLogWhereInput
> {
  constructor() {
    super(prisma.reputationLog, 'reputationLog');
  }

  /**
   * Awards reputation points to a user, increments their cached score, and logs the change.
   */
  async logAward(userId: string, change: number, reason: string, tx?: any): Promise<ReputationLog> {
    const client = tx || prisma;

    const log = await client.reputationLog.create({
      data: {
        userId,
        change,
        reason
      }
    });

    await client.user.update({
      where: { id: userId },
      data: {
        reputation: {
          increment: change
        }
      }
    });

    return log;
  }
}
export const reputationLogRepository = new ReputationLogRepository();
