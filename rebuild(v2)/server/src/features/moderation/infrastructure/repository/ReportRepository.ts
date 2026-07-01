import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Report, Prisma } from '@prisma/client';

export class ReportRepository extends BaseRepository<
  Report,
  Prisma.ReportCreateInput,
  Prisma.ReportUpdateInput,
  Prisma.ReportWhereUniqueInput,
  Prisma.ReportWhereInput
> {
  constructor() {
    super(prisma.report, 'report');
  }

  /**
   * Finds all unassigned reports awaiting review.
   */
  async findOpenReports(tx?: any): Promise<Report[]> {
    return this.getDelegate(tx).findMany({
      where: { status: 'pending' },
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Finds reports currently assigned to a specific moderator.
   */
  async findAssignedReports(moderatorId: string, tx?: any): Promise<Report[]> {
    return this.getDelegate(tx).findMany({
      where: { assignedId: moderatorId, status: 'assigned' },
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Retrieves reports registered against a community.
   */
  async findCommunityViolations(communityId: string, tx?: any): Promise<Report[]> {
    return this.getDelegate(tx).findMany({
      where: { reportedCommunityId: communityId },
      orderBy: { createdAt: 'desc' }
    });
  }
}
export const reportRepository = new ReportRepository();
