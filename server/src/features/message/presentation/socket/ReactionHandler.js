import { SocketEventRegistry } from "../../../../infrastructure/socket/SocketServer.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { reputationLogRepository } from "../../../analytics/infrastructure/repository/ReputationLogRepository.js";

export class ReactionHandler {
  eventName = "chat.message.reacted";

  async handle(socket, data) {
    const { roomId, messageId, reactionCounts, emoji, active } = data || {};
    if (!roomId || !messageId || !reactionCounts) return;

    // Broadcast to other sockets in the room channel
    socket.to(roomId).emit("chat.message.reacted", {
      success: true,
      data: { roomId, messageId, reactionCounts },
    });

    // Persist reaction to database if user is authenticated and emoji details are provided
    if (emoji && socket.user?.id) {
      if (active) {
        try {
          await prisma.reaction.upsert({
            where: {
              userId_messageId_emoji: {
                userId: socket.user.id,
                messageId,
                emoji,
              },
            },
            update: {},
            create: {
              userId: socket.user.id,
              messageId,
              emoji,
            },
          });
        } catch (e) {
          Logger.error("Failed to create reaction in DB:", e);
        }
      } else {
        try {
          await prisma.reaction.deleteMany({
            where: {
              userId: socket.user.id,
              messageId,
              emoji,
            },
          });
        } catch (e) {
          Logger.error("Failed to delete reaction from DB:", e);
        }
      }
    }

    try {
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { userId: true },
      });
      if (message && socket.server) {
        if (emoji && socket.user?.id && message.userId !== socket.user.id) {
          const change = active ? 15 : -15;
          await reputationLogRepository.logAward(
            message.userId,
            change,
            active ? "reaction.received" : "reaction.removed",
          );
        }
        socket.server.to(message.userId).emit("user.reputation.updated", { userId: message.userId });
      }
    } catch (err) {
      Logger.error("ReactionHandler reputation update failed:", err);
    }

    Logger.debug(`User ${socket.user?.id} reacted to message ${messageId} in room ${roomId}`);
  }
}

SocketEventRegistry.register(new ReactionHandler());
