import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";
import { NotificationCreatedEvent } from "../../application/commands/SocialCommands.js";
import { EmailService } from "../../../../infrastructure/email/EmailService.js";
import crypto from "crypto";

export function registerNotificationSubscribers() {
  EventBus.subscribe("message.created", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing message.created event for reply check (Message ID: ${event.messageId})`);
    try {
      const reply = await prisma.message.findUnique({
        where: { id: event.messageId },
        include: {
          user: {
            select: { id: true, name: true, username: true }
          },
          room: {
            select: { id: true, title: true }
          }
        }
      });

      if (reply && reply.parentId) {
        const parentMessage = await prisma.message.findUnique({
          where: { id: reply.parentId },
          include: {
            user: {
              select: { id: true, name: true, username: true, email: true }
            }
          }
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

          // Dispatch email notification to parent message author
          if (parentMessage.user && parentMessage.user.email) {
            try {
              // --- Build full thread context for the email ---

              // Build the full ancestor chain: [rootMessage, ..., grandParent, parentMessage]
              const ancestorChain = [];
              let walkerCursor = {
                id: parentMessage.id,
                content: parentMessage.content,
                userId: parentMessage.userId,
                parentId: parentMessage.parentId,
                createdAt: parentMessage.createdAt,
                user: parentMessage.user
              };
              while (walkerCursor) {
                ancestorChain.unshift(walkerCursor);
                if (walkerCursor.parentId) {
                  walkerCursor = await prisma.message.findUnique({
                    where: { id: walkerCursor.parentId },
                    include: {
                      user: { select: { id: true, name: true, username: true, avatar: true } }
                    }
                  });
                } else {
                  break;
                }
              }

              // Fetch all prior sibling replies (same parentId, before this reply)
              const priorReplies = await prisma.message.findMany({
                where: {
                  parentId: reply.parentId,
                  id: { not: reply.id },
                  deleted: false,
                  createdAt: { lte: reply.createdAt }
                },
                include: {
                  user: { select: { id: true, name: true, username: true, avatar: true } }
                },
                orderBy: { createdAt: "asc" }
              });

              await EmailService.sendReplyNotificationEmail(
                parentMessage.user.email,
                parentMessage.user.username,
                parentMessage.content,
                reply.user.username,
                reply.content,
                reply.roomId,
                reply.room.title,
                ancestorChain,
                priorReplies
              );
            } catch (err) {
              Logger.error(`NotificationEventSubscribers: Failed to send reply notification email to ${parentMessage.user.email}:`, err);
            }
          }

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

  // Listen for report creation to notify platform moderators and the room owner
  EventBus.subscribe("report.created", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing report.created event for report ID: ${event.reportId}`);
    try {
      const report = await prisma.report.findUnique({
        where: { id: event.reportId },
        include: {
          reporter: { select: { id: true, username: true, name: true, avatar: true } },
          room: { select: { id: true, title: true, createdById: true } },
          reportedCommunity: { select: { id: true, name: true, createdById: true } }
        }
      });

      if (!report) return;

      const recipientIds = new Set();

      // 1. Platform moderators (only PLATFORM_MOD role)
      const platformMods = await prisma.user.findMany({
        where: {
          role: "PLATFORM_MOD",
          isDeleted: false
        },
        select: { id: true }
      });
      const platformModIds = new Set(platformMods.map(u => u.id));

      // 2. Room / Community Owners
      const owners = new Set();
      if (report.room && report.room.createdById) {
        owners.add(report.room.createdById);
      }
      if (report.reportedCommunity && report.reportedCommunity.createdById) {
        owners.add(report.reportedCommunity.createdById);
      }

      platformModIds.forEach(id => recipientIds.add(id));
      owners.forEach(id => recipientIds.add(id));

      // Avoid notifying the reporter themselves
      recipientIds.delete(report.reporterId);

      // Avoid notifying the reported user, unless they are a platform mod or room owner
      if (report.reportedUserId) {
        if (!platformModIds.has(report.reportedUserId) && !owners.has(report.reportedUserId)) {
          recipientIds.delete(report.reportedUserId);
        }
      }

      // Bulk create notifications in database (Task 4.2 optimization)
      const notificationsData = [];
      const notificationRecords = [];
      for (const userId of recipientIds) {
        const id = crypto.randomUUID();
        const notificationData = {
          id,
          type: "report",
          title: "New Report Filed",
          body: `A new report has been filed by @${report.reporter.username} for "${report.reason}".`,
          roomId: report.roomId,
          referenceId: report.id,
          userId,
          triggerId: report.reporterId,
        };
        notificationsData.push(notificationData);
        notificationRecords.push({
          ...notificationData,
          trigger: {
            id: report.reporter.id,
            username: report.reporter.username,
            name: report.reporter.name || null,
            avatar: report.reporter.avatar || null,
          }
        });
      }

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({
          data: notificationsData,
        });

        // Realtime emit
        if (io) {
          for (const notification of notificationRecords) {
            io.to(notification.userId).emit("notification.created", {
              success: true,
              data: notification,
            });
          }
        }
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process report.created notification:`, err);
    }
  });

  // Listen for report resolution to notify the reporter
  EventBus.subscribe("report.resolved", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing report.resolved event for report ID: ${event.reportId}`);
    try {
      const report = await prisma.report.findUnique({
        where: { id: event.reportId }
      });

      if (!report || !report.reporterId) return;

      const notification = await prisma.notification.create({
        data: {
          type: "report_resolved",
          title: "Report Resolved",
          body: `Your report for "${report.reason}" has been resolved: ${report.resolutionReason || "No details provided"}.`,
          roomId: report.roomId,
          referenceId: report.id,
          user: { connect: { id: report.reporterId } },
          ...(report.resolvedById ? { trigger: { connect: { id: report.resolvedById } } } : {})
        }
      });

      if (io) {
        io.to(report.reporterId).emit("notification.created", {
          success: true,
          data: notification
        });
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process report.resolved notification:`, err);
    }
  });

  // Listen for report escalation to notify platform staff
  EventBus.subscribe("report.escalated", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing report.escalated event for report ID: ${event.reportId}`);
    try {
      const report = await prisma.report.findUnique({
        where: { id: event.reportId }
      });

      if (!report) return;

      const platformMods = await prisma.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"] },
          isDeleted: false
        },
        select: { id: true }
      });

      const notificationsData = [];
      const notificationRecords = [];
      for (const mod of platformMods) {
        const id = crypto.randomUUID();
        const notificationData = {
          id,
          type: "report_escalated",
          title: "Report Escalated",
          body: `A report for "${report.reason}" has been escalated to platform staff.`,
          roomId: report.roomId,
          referenceId: report.id,
          userId: mod.id,
        };
        notificationsData.push(notificationData);
        notificationRecords.push(notificationData);
      }

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({
          data: notificationsData,
        });

        if (io) {
          for (const notification of notificationRecords) {
            io.to(notification.userId).emit("notification.created", {
              success: true,
              data: notification,
            });
          }
        }
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process report.escalated notification:`, err);
    }
  });

  // Listen for moderation actions to notify target user
  EventBus.subscribe("moderation.action.executed", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing moderation.action.executed event for action ID: ${event.actionId}`);
    try {
      const action = await prisma.moderationAction.findUnique({
        where: { id: event.actionId }
      });

      if (!action || !action.userId) return;

      const actionLabel = action.type.toUpperCase();
      const notification = await prisma.notification.create({
        data: {
          type: `moderation_${action.type}`,
          title: `Account Action: ${actionLabel}`,
          body: `A moderation action (${actionLabel}) has been applied to your account. Reason: "${action.reason}"`,
          roomId: action.roomId,
          referenceId: action.id,
          user: { connect: { id: action.userId } },
          ...(action.actorId ? { trigger: { connect: { id: action.actorId } } } : {})
        }
      });

      if (io) {
        io.to(action.userId).emit("notification.created", {
          success: true,
          data: notification
        });
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process moderation.action.executed notification:`, err);
    }
  });

  // Listen for appeal resolution to notify user
  EventBus.subscribe("appeal.resolved", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing appeal.resolved event for appeal ID: ${event.appealId}`);
    try {
      const appeal = await prisma.appeal.findUnique({
        where: { id: event.appealId }
      });

      if (!appeal || !appeal.userId) return;

      const statusLabel = appeal.status.toUpperCase();
      const notification = await prisma.notification.create({
        data: {
          type: `appeal_${appeal.status}`,
          title: `Appeal ${statusLabel}`,
          body: `Your appeal has been ${appeal.status}. Resolution: "${appeal.resolution || "No details provided"}"`,
          referenceId: appeal.id,
          user: { connect: { id: appeal.userId } },
          ...(appeal.resolvedById ? { trigger: { connect: { id: appeal.resolvedById } } } : {})
        }
      });

      if (io) {
        io.to(appeal.userId).emit("notification.created", {
          success: true,
          data: notification
        });
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process appeal.resolved notification:`, err);
    }
  });

  // Listen for appeal submission to notify admins
  EventBus.subscribe("appeal.submitted", async (event) => {
    Logger.info(`NotificationEventSubscribers: Processing appeal.submitted event for appeal ID: ${event.appealId}`);
    try {
      const appeal = await prisma.appeal.findUnique({
        where: { id: event.appealId },
        include: {
          user: { select: { username: true } }
        }
      });

      if (!appeal) return;

      // Find recipients: Platform administrators (SUPER_ADMIN, PLATFORM_ADMIN, ADMIN, SUPERADMIN)
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ["SUPER_ADMIN", "PLATFORM_ADMIN", "ADMIN", "SUPERADMIN"] },
          isDeleted: false
        },
        select: { id: true }
      });

      const notificationsData = [];
      const notificationRecords = [];
      for (const admin of admins) {
        const id = crypto.randomUUID();
        const notificationData = {
          id,
          type: "appeal_submitted",
          title: "New Appeal Submitted",
          body: `A new restriction appeal has been submitted by @${appeal.user.username}.`,
          referenceId: appeal.id,
          userId: admin.id,
          triggerId: appeal.userId,
        };
        notificationsData.push(notificationData);
        notificationRecords.push({
          ...notificationData,
          trigger: {
            id: appeal.userId,
            username: appeal.user.username,
          }
        });
      }

      if (notificationsData.length > 0) {
        await prisma.notification.createMany({
          data: notificationsData,
        });

        // Socket emit
        if (io) {
          for (const notification of notificationRecords) {
            io.to(notification.userId).emit("notification.created", {
              success: true,
              data: notification,
            });
          }
        }
      }
    } catch (err) {
      Logger.error(`NotificationEventSubscribers: Failed to process appeal.submitted notification:`, err);
    }
  });
}
