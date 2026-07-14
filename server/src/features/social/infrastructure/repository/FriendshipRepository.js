import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class FriendshipRepository extends BaseRepository {
  constructor() {
    super(prisma.friendship, "friendship");
  }

  /**
   * Finds a friendship record between User A and User B (bidirectional search).
   */
  async findFriendship(userId, friendId, tx) {
    return this.getDelegate(tx).findFirst({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
  }

  /**
   * Retrieves all accepted friendships for a user, filtering out deleted accounts.
   */
  async findFriends(userId, tx) {
    const delegate = this.getDelegate(tx);
    const friendships = await delegate.findMany({
      where: {
        status: "accepted",
        OR: [
          { userId, friend: { isDeleted: false } },
          { friendId: userId, user: { isDeleted: false } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            status: true,
            lastSeen: true,
            isPaused: true,
            isDeleted: true,
          },
        },
        friend: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            status: true,
            lastSeen: true,
            isPaused: true,
            isDeleted: true,
          },
        },
      },
    });

    // Map friendship models to target user profiles, ensuring we filter out deleted users
    return friendships
      .map((f) => {
        return f.userId === userId ? f.friend : f.user;
      })
      .filter((u) => u && !u.isDeleted);
  }

  /**
   * Retrieves pending incoming friend requests for a user (awaiting user acceptance), filtering out deleted accounts.
   */
  async findPendingRequests(userId, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.findMany({
      where: {
        friendId: userId,
        status: "pending",
        user: { isDeleted: false },
      },
      include: {
        user: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  }
}
export const friendshipRepository = new FriendshipRepository();
