import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Block, Prisma } from '@prisma/client';

export class BlockRepository extends BaseRepository<
  Block,
  Prisma.BlockCreateInput,
  Prisma.BlockUpdateInput,
  Prisma.BlockWhereUniqueInput,
  Prisma.BlockWhereInput
> {
  constructor() {
    super(prisma.block, 'block');
  }

  /**
   * Resolves a block relationship between a blocker and a blocked user.
   */
  async findBlock(userId: string, blockedId: string, tx?: any): Promise<Block | null> {
    return this.getDelegate(tx).findUnique({
      where: {
        userId_blockedId: { userId, blockedId }
      }
    });
  }

  /**
   * Checks if either User A has blocked User B, or User B has blocked User A.
   */
  async hasBlockRelationship(userA: string, userB: string, tx?: any): Promise<boolean> {
    const count = await this.getDelegate(tx).count({
      where: {
        OR: [
          { userId: userA, blockedId: userB },
          { userId: userB, blockedId: userA }
        ]
      }
    });
    return count > 0;
  }
}
export const blockRepository = new BlockRepository();
