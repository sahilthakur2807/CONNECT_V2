import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class BlockRepository extends BaseRepository {
  constructor() {
    super(prisma.block, "block");
  }

  /**
   * Resolves a block relationship between a blocker and a blocked user.
   */
  async findBlock(userId, blockedId, tx) {
    return this.getDelegate(tx).findUnique({
      where: {
        userId_blockedId: { userId, blockedId },
      },
    });
  }

  /**
   * Checks if either User A has blocked User B, or User B has blocked User A.
   */
  async hasBlockRelationship(userA, userB, tx) {
    const count = await this.getDelegate(tx).count({
      where: {
        OR: [
          { userId: userA, blockedId: userB },
          { userId: userB, blockedId: userA },
        ],
      },
    });
    return count > 0;
  }
}
export const blockRepository = new BlockRepository();
