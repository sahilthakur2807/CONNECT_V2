import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { AuditLog, Prisma } from '@prisma/client';
import { ForbiddenError } from '../../../../shared/errors/AppError.js';

export class AuditLogRepository extends BaseRepository<
  AuditLog,
  Prisma.AuditLogCreateInput,
  Prisma.AuditLogUpdateInput,
  Prisma.AuditLogWhereUniqueInput,
  Prisma.AuditLogWhereInput
> {
  constructor() {
    super(prisma.auditLog, 'auditLog');
  }

  /**
   * Disallows update operations to preserve audit log immutability.
   */
  override async update(id: string, data: Prisma.AuditLogUpdateInput, tx?: any): Promise<AuditLog> {
    throw new ForbiddenError('Audit log records are immutable and cannot be updated');
  }

  /**
   * Disallows delete operations to preserve audit log immutability.
   */
  override async delete(id: string, tx?: any): Promise<AuditLog> {
    throw new ForbiddenError('Audit log records are immutable and cannot be deleted');
  }

  /**
   * Queries paginated audit logs with backward cursor-based pagination.
   */
  async findAuditRecords(limit = 50, beforeCursor?: string, tx?: any): Promise<AuditLog[]> {
    const delegate = this.getDelegate(tx);
    const where: Prisma.AuditLogWhereInput = {};

    if (beforeCursor) {
      const cursorLog = await delegate.findUnique({
        where: { id: beforeCursor }
      });
      if (cursorLog) {
        where.createdAt = {
          lt: cursorLog.createdAt
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        actor: { select: { id: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
export const auditLogRepository = new AuditLogRepository();
