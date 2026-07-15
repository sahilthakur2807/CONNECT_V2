import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class ModerationActionRepository extends BaseRepository {
  constructor() {
    super(prisma.moderationAction, "moderationAction");
  }

  async findActiveActions(userId, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.findMany({
      where: {
        userId,
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /**
   * Retrieves active, non-expired platform bans or suspensions for a specific user.
   */
  async findActivePlatformBan(userId, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.findFirst({
      where: {
        userId,
        communityId: null,
        type: { in: ["ban", "suspend"] },
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  /**
   * Evaluates if a user is currently muted inside a specific community.
   */
  async findActiveMute(userId, communityId, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.findFirst({
      where: {
        userId,
        communityId,
        type: "mute",
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }
}
export const moderationActionRepository = new ModerationActionRepository();
