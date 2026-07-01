import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class AppealRepository extends BaseRepository {
  constructor() {
    super(prisma.appeal, "appeal");
  }

  /**
   * Finds all pending appeals awaiting resolution.
   */
  async findOpenAppeals(tx) {
    return this.getDelegate(tx).findMany({
      where: { status: "pending" },
      include: {
        user: { select: { id: true, username: true } },
        action: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
export const appealRepository = new AppealRepository();
