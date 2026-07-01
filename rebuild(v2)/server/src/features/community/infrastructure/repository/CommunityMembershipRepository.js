import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class CommunityMembershipRepository extends BaseRepository {
  constructor() {
    super(prisma.communityMember, "communityMember");
  }

  /**
   * Resolves a user's membership details in a community.
   */
  async findMember(userId, communityId, tx) {
    return this.getDelegate(tx).findUnique({
      where: {
        userId_communityId: { userId, communityId },
      },
    });
  }

  /**
   * Retrieves communities that a specific user has joined.
   */
  async findUserCommunities(userId, tx) {
    return this.getDelegate(tx).findMany({
      where: { userId },
      include: {
        community: {
          select: { id: true, name: true, description: true, imageUrl: true },
        },
      },
    });
  }

  /**
   * Retrieves active, non-banned community members with pagination.
   */
  async findActiveMembers(communityId, page = 1, limit = 20, tx) {
    const delegate = this.getDelegate(tx);
    const skip = (page - 1) * limit;

    return delegate.findMany({
      where: {
        communityId,
        banned: false,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            reputation: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: {
        joinedAt: "desc",
      },
    });
  }

  /**
   * Updates a user's ban state inside a community.
   */
  async banUser(userId, communityId, reason, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.upsert({
      where: {
        userId_communityId: { userId, communityId },
      },
      update: {
        banned: true,
        banReason: reason,
      },
      create: {
        userId,
        communityId,
        banned: true,
        banReason: reason,
        role: "member",
      },
    });
  }

  /**
   * Unbans a user, allowing them to re-join.
   */
  async unbanUser(userId, communityId, tx) {
    return this.getDelegate(tx).update({
      where: {
        userId_communityId: { userId, communityId },
      },
      data: {
        banned: false,
        banReason: null,
      },
    });
  }

  /**
   * Updates a user's mute state inside a community.
   */
  async muteUser(userId, communityId, until, tx) {
    return this.getDelegate(tx).update({
      where: {
        userId_communityId: { userId, communityId },
      },
      data: {
        muted: true,
        mutedUntil: until,
      },
    });
  }

  /**
   * Unmutes a user.
   */
  async unmuteUser(userId, communityId, tx) {
    return this.getDelegate(tx).update({
      where: {
        userId_communityId: { userId, communityId },
      },
      data: {
        muted: false,
        mutedUntil: null,
      },
    });
  }
}
export const communityMembershipRepository =
  new CommunityMembershipRepository();
