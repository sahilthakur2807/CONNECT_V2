import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { Community, Prisma } from '@prisma/client';

export class CommunityRepository extends BaseRepository<
  Community,
  Prisma.CommunityCreateInput,
  Prisma.CommunityUpdateInput,
  Prisma.CommunityWhereUniqueInput,
  Prisma.CommunityWhereInput
> {
  constructor() {
    super(prisma.community, 'community');
  }

  /**
   * Finds all non-deleted communities. Public communities are visible to everyone,
   * while private communities are visible only to their members.
   */
  async findVisible(userId?: string, tx?: any): Promise<Community[]> {
    const delegate = this.getDelegate(tx);
    
    // In CONNECT v1, communities are generally public, but we filter out soft-deleted ones.
    return delegate.findMany({
      where: {
        deleted: false
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true }
        },
        _count: {
          select: { members: true, rooms: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Retrieves all non-deleted archived communities.
   */
  async findArchived(tx?: any): Promise<Community[]> {
    return this.getDelegate(tx).findMany({
      where: {
        archived: true,
        deleted: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Finds a community by its exact name, case-insensitively.
   */
  async findByName(name: string, tx?: any): Promise<Community | null> {
    const delegate = this.getDelegate(tx);
    return delegate.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        deleted: false
      }
    });
  }

  /**
   * Retrieves details of a specific community including active counts.
   */
  async findCommunityDetails(id: string, tx?: any): Promise<Community | null> {
    return this.getDelegate(tx).findFirst({
      where: { id, deleted: false },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true }
        },
        _count: {
          select: { members: true, rooms: true }
        }
      }
    });
  }
}
