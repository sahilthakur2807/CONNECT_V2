import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";

export class AuditLogRepository extends BaseRepository {
  constructor() {
    super(prisma.auditLog, "auditLog");
  }

  /**
   * Disallows update operations to preserve audit log immutability.
   */
  async update(id, data, tx) {
    throw new ForbiddenError(
      "Audit log records are immutable and cannot be updated",
    );
  }

  /**
   * Disallows delete operations to preserve audit log immutability.
   */
  async delete(id, tx) {
    throw new ForbiddenError(
      "Audit log records are immutable and cannot be deleted",
    );
  }

  /**
   * Queries paginated audit logs with backward cursor-based pagination.
   */
  async findAuditRecords(limit = 50, beforeCursor, actorId, tx) {
    const delegate = this.getDelegate(tx);
    const where = {};

    if (actorId) {
      where.actorId = actorId;
    }

    if (beforeCursor) {
      const cursorLog = await delegate.findUnique({
        where: { id: beforeCursor },
      });
      if (cursorLog) {
        where.createdAt = {
          lt: cursorLog.createdAt,
        };
      }
    }

    return delegate.findMany({
      where,
      include: {
        actor: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }
}
export const auditLogRepository = new AuditLogRepository();
