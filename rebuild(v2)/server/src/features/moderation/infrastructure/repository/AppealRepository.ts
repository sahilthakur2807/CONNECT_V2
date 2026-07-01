import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Appeal, Prisma } from '@prisma/client';

export class AppealRepository extends BaseRepository<
  Appeal,
  Prisma.AppealCreateInput,
  Prisma.AppealUpdateInput,
  Prisma.AppealWhereUniqueInput,
  Prisma.AppealWhereInput
> {
  constructor() {
    super(prisma.appeal, 'appeal');
  }

  /**
   * Finds all pending appeals awaiting resolution.
   */
  async findOpenAppeals(tx?: any): Promise<Appeal[]> {
    return this.getDelegate(tx).findMany({
      where: { status: 'pending' },
      include: {
        user: { select: { id: true, username: true } },
        action: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}
export const appealRepository = new AppealRepository();
