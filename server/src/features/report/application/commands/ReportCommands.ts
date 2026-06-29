import { prisma } from '@infrastructure/db/PrismaClient.js';
import { NotFoundError, UnauthorizedError } from '@shared/errors/AppError.js';

// --- Commands ---

export class CreateReportCommand {
  constructor(
    public readonly reporterId: string,
    public readonly reason: string,
    public readonly description: string,
    public readonly severity: string = 'medium',
    public readonly reportedUserId?: string,
    public readonly messageId?: string,
    public readonly roomId?: string
  ) {}
}

export class UpdateReportCommand {
  constructor(
    public readonly reportId: string,
    public readonly status: string,
    public readonly userId: string,
    public readonly userRole: string
  ) {}
}

// --- Handlers ---

export class CreateReportHandler {
  async execute(command: CreateReportCommand) {
    return prisma.report.create({
      data: {
        reason: command.reason,
        description: command.description,
        severity: command.severity,
        reporterId: command.reporterId,
        reportedUserId: command.reportedUserId || null,
        messageId: command.messageId || null,
        roomId: command.roomId || null
      }
    });
  }
}

export class UpdateReportHandler {
  async execute(command: UpdateReportCommand) {
    const report = await prisma.report.findUnique({
      where: { id: command.reportId }
    });

    if (!report) {
      throw new NotFoundError('Report not found');
    }

    const isAdminOrSuperAdmin = command.userRole === 'admin' || command.userRole === 'superadmin';
    const isCommonModerator = command.userRole === 'moderator';

    let isRoomCreator = false;
    if (report.roomId) {
      const room = await prisma.room.findUnique({ where: { id: report.roomId } });
      if (room && room.createdById === command.userId) {
        isRoomCreator = true;
      }
    } else if (report.messageId) {
      const message = await prisma.message.findUnique({ where: { id: report.messageId } });
      if (message) {
        const room = await prisma.room.findUnique({ where: { id: message.roomId } });
        if (room && room.createdById === command.userId) {
          isRoomCreator = true;
        }
      }
    }

    if (!isAdminOrSuperAdmin && !isCommonModerator && !isRoomCreator) {
      throw new UnauthorizedError('Access denied');
    }

    return prisma.report.update({
      where: { id: command.reportId },
      data: { status: command.status }
    });
  }
}
