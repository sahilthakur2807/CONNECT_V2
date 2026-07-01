import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class ReputationLogRepository extends BaseRepository {
  constructor() {
    super(prisma.reputationLog, "reputationLog");
  }

  /**
   * Awards reputation points to a user, increments their cached score, and logs the change.
   */
  async logAward(userId, change, reason, tx) {
    const client = tx || prisma;

    const log = await client.reputationLog.create({
      data: {
        userId,
        change,
        reason,
      },
    });

    await client.user.update({
      where: { id: userId },
      data: {
        reputation: {
          increment: change,
        },
      },
    });

    return log;
  }
}
export const reputationLogRepository = new ReputationLogRepository();
