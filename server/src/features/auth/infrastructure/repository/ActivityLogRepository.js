import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class ActivityLogRepository extends BaseRepository {
  constructor() {
    super(prisma.activityLog, "activityLog");
  }

  async logAction(userId, action, details, tx) {
    return this.create(
      {
        action,
        details,
        user: { connect: { id: userId } },
      },
      tx,
    );
  }
}
export const activityLogRepository = new ActivityLogRepository();
