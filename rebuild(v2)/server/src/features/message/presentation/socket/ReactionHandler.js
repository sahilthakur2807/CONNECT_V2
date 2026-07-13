import { SocketEventRegistry } from "../../../../infrastructure/socket/SocketServer.js";
import { Logger } from "../../../../shared/logger/Logger.js";

export class ReactionHandler {
  eventName = "chat.message.reacted";

  async handle(socket, data) {
    const { roomId, messageId, reactionCounts } = data || {};
    if (!roomId || !messageId || !reactionCounts) return;

    // Broadcast to other sockets in the room channel
    socket.to(roomId).emit("chat.message.reacted", {
      success: true,
      data: { roomId, messageId, reactionCounts },
    });

    Logger.debug(`User ${socket.user?.id} reacted to message ${messageId} in room ${roomId}`);
  }
}

SocketEventRegistry.register(new ReactionHandler());
