import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Friendship, Prisma } from '@prisma/client';

export class FriendshipRepository extends BaseRepository<
  Friendship,
  Prisma.FriendshipCreateInput,
  Prisma.FriendshipUpdateInput,
  Prisma.FriendshipWhereUniqueInput,
  Prisma.FriendshipWhereInput
> {
  constructor() {
    super(prisma.friendship, 'friendship');
  }

  /**
   * Finds a friendship record between User A and User B (bidirectional search).
   */
  async findFriendship(userId: string, friendId: string, tx?: any): Promise<Friendship | null> {
    return this.getDelegate(tx).findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId }
        ]
      }
    });
  }

  /**
   * Retrieves all accepted friendships for a user.
   */
  async findFriends(userId: string, tx?: any): Promise<any[]> {
    const delegate = this.getDelegate(tx);
    const friendships = await delegate.findMany({
      where: {
        status: 'accepted',
        OR: [
          { userId },
          { friendId: userId }
        ]
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true, status: true, lastSeen: true }
        },
        friend: {
          select: { id: true, username: true, name: true, avatar: true, status: true, lastSeen: true }
        }
      }
    });

    // Map friendship models to target user profiles
    return friendships.map((f: any) => {
      return f.userId === userId ? f.friend : f.user;
    });
  }

  /**
   * Retrieves pending incoming friend requests for a user (awaiting user acceptance).
   */
  async findPendingRequests(userId: string, tx?: any): Promise<any[]> {
    const delegate = this.getDelegate(tx);
    return delegate.findMany({
      where: {
        friendId: userId,
        status: 'pending'
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true }
        }
      }
    });
  }
}
export const friendshipRepository = new FriendshipRepository();
