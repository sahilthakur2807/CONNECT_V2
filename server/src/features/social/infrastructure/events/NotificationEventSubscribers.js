import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";
import { NotificationCreatedEvent } from "../../application/commands/SocialCommands.js";

export function registerNotificationSubscribers() {
  // Listen for message creation to trigger reply notifications
  EventBus.subscribe("message.created", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing message.created event for reply check (Message ID: ${event.messageId})`);
    try {
      const reply = await prisma.message.findUnique({
        where: { id: event.messageId },
        include: {
          user: {
            select: { id: true, name: true, username: true }
          }
        }
      });

      if (reply && reply.parentId) {
        const parentMessage = await prisma.message.findUnique({
          where: { id: reply.parentId },
          select: { userId: true }
        });

        // Only notify if replying to someone else's message
        if (parentMessage && parentMessage.userId !== reply.userId) {
          const bodyPreview = reply.content.length > 60 
            ? `${reply.content.substring(0, 60)}...` 
            : reply.content;

          const triggerName = reply.user.name || reply.user.username;

          const notification = await prisma.notification.create({
            data: {
              type: "reply",
              title: "New Reply",
              body: `${triggerName} replied: "${bodyPreview}"`,
              roomId: reply.roomId,
              referenceId: parentMessage.id,
              user: { connect: { id: parentMessage.userId } },
              trigger: { connect: { id: reply.userId } },
            },
            include: {
              trigger: {
                select: { id: true, username: true, name: true, avatar: true },
              },
            }
          });

          Logger.info(`NotificationEventSubscribers: Reply notification created successfully for user ${parentMessage.userId}`);

          // Publish event on EventBus
          await EventBus.publish(new NotificationCreatedEvent(notification.id, parentMessage.userId));

          // Realtime alert emission directly to recipient's socket room
          if (io) {
            io.to(parentMessage.userId).emit("notification.created", {
              success: true,
              data: notification,
            });
            Logger.info(`NotificationEventSubscribers: Realtime socket notification emitted to user ${parentMessage.userId}`);
          }
        }
      }
    } catch (err) {
      Logger.error(
        `NotificationEventSubscribers: Failed to process reply notification for message ${event.messageId}:`,
        err,
      );
    }
  });
}
