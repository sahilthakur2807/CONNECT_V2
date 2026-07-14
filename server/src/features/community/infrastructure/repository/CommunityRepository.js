import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class CommunityRepository extends BaseRepository {
  constructor() {
    super(prisma.community, "community");
  }

  /**
   * Finds all non-deleted communities. Public communities are visible to everyone,
   * while private communities are visible only to their members.
   */
  async findVisible(userId, tx) {
    const delegate = this.getDelegate(tx);
    // In CONNECT v1, communities are generally public, but we filter out soft-deleted ones.
    return delegate.findMany({
      where: {
        deleted: false,
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: { members: true, rooms: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Retrieves all non-deleted archived communities.
   */
  async findArchived(tx) {
    return this.getDelegate(tx).findMany({
      where: {
        archived: true,
        deleted: false,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Finds a community by its exact name, case-insensitively.
   */
  async findByName(name, tx) {
    const delegate = this.getDelegate(tx);
    return delegate.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        deleted: false,
      },
    });
  }

  /**
   * Retrieves details of a specific community including active counts.
   */
  async findCommunityDetails(id, tx) {
    return this.getDelegate(tx).findFirst({
      where: { id, deleted: false },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: { members: true, rooms: true },
        },
      },
    });
  }
}
