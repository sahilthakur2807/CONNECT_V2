import { ReportRepository } from '../../infrastructure/repository/ReportRepository.js';
import { AuditLogRepository } from '../../infrastructure/repository/AuditLogRepository.js';
import { AppealRepository } from '../../infrastructure/repository/AppealRepository.js';
import { ModerationPolicy } from '../ModerationPolicy.js';
import { ForbiddenError } from '../../../../shared/errors/AppError.js';

// --- Queries ---

export class GetReportsQuery {
  constructor(
    public readonly userId: string,
    public readonly userRole: string,
    public readonly type: 'open' | 'assigned' = 'open'
  ) {}
}

export class GetAuditLogsQuery {
  constructor(
    public readonly userId: string,
    public readonly userRole: string,
    public readonly limit = 50,
    public readonly cursor?: string
  ) {}
}

export class GetOpenAppealsQuery {
  constructor(
    public readonly userId: string,
    public readonly userRole: string
  ) {}
}

// --- Handlers ---

export class GetReportsHandler {
  constructor(private readonly reportRepo: ReportRepository) {}

  async execute(query: GetReportsQuery): Promise<any[]> {
    const allowed = ModerationPolicy.canManageReport({ id: query.userId, role: query.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to view reports');

    if (query.type === 'assigned') {
      return this.reportRepo.findAssignedReports(query.userId);
    }
    return this.reportRepo.findOpenReports();
  }
}

export class GetAuditLogsHandler {
  constructor(private readonly auditRepo: AuditLogRepository) {}

  async execute(query: GetAuditLogsQuery): Promise<any[]> {
    const allowed = ModerationPolicy.canViewAuditLogs({ id: query.userId, role: query.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to view audit logs');

    return this.auditRepo.findAuditRecords(query.limit, query.cursor);
  }
}

export class GetOpenAppealsHandler {
  constructor(private readonly appealRepo: AppealRepository) {}

  async execute(query: GetOpenAppealsQuery): Promise<any[]> {
    const allowed = ModerationPolicy.canResolveAppeal({ id: query.userId, role: query.userRole });
    if (!allowed) throw new ForbiddenError('You do not have permission to view appeals');

    return this.appealRepo.findOpenAppeals();
  }
}
