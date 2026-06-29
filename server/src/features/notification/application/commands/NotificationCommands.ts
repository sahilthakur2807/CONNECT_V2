import { prisma } from '@infrastructure/db/PrismaClient.js';
import { NotFoundError } from '@shared/errors/AppError.js';

// --- Commands ---

export class MarkAllNotificationsReadCommand {
  constructor(public readonly userId: string) {}
}

export class MarkNotificationReadCommand {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string
  ) {}
}

// --- Handlers ---

export class MarkAllNotificationsReadHandler {
  async execute(command: MarkAllNotificationsReadCommand): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId: command.userId, read: false },
      data: { read: true }
    });
  }
}

export class MarkNotificationReadHandler {
  async execute(command: MarkNotificationReadCommand): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { id: command.notificationId }
    });

    if (!notification || notification.userId !== command.userId) {
      throw new NotFoundError('Notification not found or unauthorized');
    }

    await prisma.notification.update({
      where: { id: command.notificationId },
      data: { read: true }
    });
  }
}
