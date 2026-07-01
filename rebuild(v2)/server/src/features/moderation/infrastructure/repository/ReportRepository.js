import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class ReportRepository extends BaseRepository {
  constructor() {
    super(prisma.report, "report");
  }

  /**
   * Finds all unassigned reports awaiting review.
   */
  async findOpenReports(tx) {
    return this.getDelegate(tx).findMany({
      where: { status: "pending" },
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Finds reports currently assigned to a specific moderator.
   */
  async findAssignedReports(moderatorId, tx) {
    return this.getDelegate(tx).findMany({
      where: { assignedId: moderatorId, status: "assigned" },
      include: {
        reporter: { select: { id: true, username: true } },
        reportedUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Retrieves reports registered against a community.
   */
  async findCommunityViolations(communityId, tx) {
    return this.getDelegate(tx).findMany({
      where: { reportedCommunityId: communityId },
      orderBy: { createdAt: "desc" },
    });
  }
}
export const reportRepository = new ReportRepository();
