import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { io } from "../../../../infrastructure/socket/SocketServer.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

export function registerRoomEventSubscribers() {
  // Listen for room creation to broadcast to all clients for real-time Room Discovery
  EventBus.subscribe("room.created", async (event) => {
    Logger.info(`RoomEventSubscribers: Processing room.created for room ID: ${event.roomId}`);
    try {
      if (io) {
        const room = await prisma.room.findUnique({
          where: { id: event.roomId },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            tags: true,
            imageUrl: true,
            isPrivate: true,
            archived: true,
            createdAt: true,
            createdById: true,
            communityId: true
          }
        });
        if (room) {
          io.emit("room.created", { success: true, data: room });
        }
      }
    } catch (err) {
      Logger.error(`RoomEventSubscribers: Failed to process room.created:`, err);
    }
  });

  // Listen for room updates to notify clients of changes (e.g. category, details)
  EventBus.subscribe("room.updated", async (event) => {
    Logger.info(`RoomEventSubscribers: Processing room.updated for room ID: ${event.roomId}`);
    try {
      if (io) {
        const room = await prisma.room.findUnique({
          where: { id: event.roomId },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            tags: true,
            imageUrl: true,
            isPrivate: true,
            archived: true,
            createdAt: true,
            createdById: true,
            communityId: true
          }
        });
        if (room) {
          io.emit("room.updated", { success: true, data: room });
        }
      }
    } catch (err) {
      Logger.error(`RoomEventSubscribers: Failed to process room.updated:`, err);
    }
  });

  // Listen for room archive events
  EventBus.subscribe("room.archived", async (event) => {
    Logger.info(`RoomEventSubscribers: Processing room.archived for room ID: ${event.roomId}`);
    try {
      if (io) {
        io.emit("room.archived", { success: true, roomId: event.roomId });
      }
    } catch (err) {
      Logger.error(`RoomEventSubscribers: Failed to process room.archived:`, err);
    }
  });

  // Listen for room deletion events
  EventBus.subscribe("room.deleted", async (event) => {
    Logger.info(`RoomEventSubscribers: Processing room.deleted for room ID: ${event.roomId}`);
    try {
      if (io) {
        io.emit("room.deleted", { success: true, roomId: event.roomId });
      }
    } catch (err) {
      Logger.error(`RoomEventSubscribers: Failed to process room.deleted:`, err);
    }
  });
}
