import { Server as SocketServer } from "socket.io";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { config } from "../../config/index.js";
import { Logger } from "../../shared/logger/Logger.js";
import { prisma } from "../db/PrismaClient.js";

export let io = null;
export let httpServer = null;
export const activeUserConnections = new Map();

// Registry interface for dynamic event bindings

export class SocketEventRegistry {
  static handlers = new Set();

  static register(handler) {
    this.handlers.add(handler);
    Logger.info(`Registered socket event handler: "${handler.eventName}"`);
  }

  static getHandlers() {
    return Array.from(this.handlers);
  }
}

export function initializeSocketServer(app) {
  httpServer = createServer(app);
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ["GET", "POST"],
    },
    pingInterval: 25000, // Heartbeat ping check interval
    pingTimeout: 20000, // Connection timeout limit
    transports: ["websocket", "polling"],
  });

  // Authentication handshake middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      Logger.warn(
        `Socket connection rejected: Token missing. Socket ID: ${socket.id}`,
      );
      return next(new Error("Authentication failed: Token missing"));
    }
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);

      // Check active platform bans/suspensions
      const activeBan = await prisma.moderationAction.findFirst({
        where: {
          userId: decoded.id,
          communityId: null,
          type: { in: ["ban", "suspend"] },
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (activeBan) {
        Logger.warn(
          `Socket connection rejected: User ${decoded.id} is platform-${activeBan.type}ed. Socket ID: ${socket.id}`,
        );
        return next(new Error(`Authentication failed: User is platform-${activeBan.type}ed`));
      }

      socket.user = decoded;
      Logger.debug(
        `Socket connection authenticated: User ID ${decoded.id}, Socket ID: ${socket.id}`,
      );
      next();
    } catch (err) {
      Logger.warn(
        `Socket connection rejected: Invalid token verification. Socket ID: ${socket.id}`,
      );
      next(new Error("Authentication failed: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    Logger.info(
      `Client connected: Socket ID ${socket.id}, User ID: ${user?.id}`,
    );

    if (user) {
      // 1. Join user-specific private channel for direct notifications
      socket.join(user.id);

      // 1b. Join moderators dashboard channel if authorized admin/moderator
      if (
        ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(user.role)
      ) {
        socket.join("moderators");
      }

      // 2. Track connection set
      let connections = activeUserConnections.get(user.id);
      if (!connections) {
        connections = new Set();
        activeUserConnections.set(user.id, connections);
      }
      connections.add(socket.id);

      // 3. Update database presence if this is the user's first active tab
      if (connections.size === 1) {
        prisma.user.findUnique({
          where: { id: user.id },
          select: { isPaused: true }
        })
        .then((dbUser) => {
          const isPaused = dbUser?.isPaused || false;
          return prisma.user.update({
            where: { id: user.id },
            data: { status: isPaused ? "paused" : "online" },
          })
          .then(() => {
            if (isPaused) {
              io?.to("moderators").emit("presence.online", { userId: user.id, isPaused: true });
            } else {
              io?.emit("presence.online", { userId: user.id });
            }

            // Find friends to broadcast presence change
            return prisma.friendship.findMany({
              where: {
                status: "accepted",
                OR: [{ userId: user.id }, { friendId: user.id }],
              },
            });
          })
          .then((friendships) => {
            if (!friendships || isPaused) return;
            const friendIds = friendships.map((f) =>
              f.userId === user.id ? f.friendId : f.userId,
            );
            for (const friendId of friendIds) {
              io?.to(friendId).emit("presence.online", { userId: user.id });
            }
          });
        })
        .catch((err) =>
          Logger.error(
            `Failed to update user ${user.id} presence to online:`,
            err,
          ),
        );
      }
    }

    // Dynamic registry dispatch
    const handlers = SocketEventRegistry.getHandlers();
    for (const handler of handlers) {
      socket.on(handler.eventName, async (data) => {
        try {
          await handler.handle(socket, data);
        } catch (error) {
          Logger.error(
            `Error executing socket event "${handler.eventName}" for User ID ${user?.id}:`,
            error,
          );
        }
      });
    }

    socket.on("disconnecting", () => {
      for (const roomId of socket.rooms) {
        if (
          roomId === user?.id ||
          roomId === socket.id ||
          roomId === "moderators"
        ) {
          continue;
        }
        broadcastRoomActiveUsers(roomId, socket.id);
      }
    });

    socket.on("disconnect", (reason) => {
      Logger.info(
        `Client disconnected: Socket ID ${socket.id}, Reason: ${reason}`,
      );

      if (user) {
        const connections = activeUserConnections.get(user.id);
        if (connections) {
          connections.delete(socket.id);
          if (connections.size === 0) {
            activeUserConnections.delete(user.id);

            prisma.user.findUnique({
              where: { id: user.id },
              select: { isPaused: true }
            })
            .then((dbUser) => {
              const isPaused = dbUser?.isPaused || false;
              return prisma.user.update({
                where: { id: user.id },
                data: { status: "offline", lastSeen: new Date() },
              })
              .then(() => {
                if (isPaused) {
                  io?.to("moderators").emit("presence.offline", { userId: user.id, isPaused: true });
                } else {
                  io?.emit("presence.offline", { userId: user.id });
                }

                // Find friends to broadcast presence change
                return prisma.friendship.findMany({
                  where: {
                    status: "accepted",
                    OR: [{ userId: user.id }, { friendId: user.id }],
                  },
                });
              })
              .then((friendships) => {
                if (!friendships || isPaused) return;
                const friendIds = friendships.map((f) =>
                  f.userId === user.id ? f.friendId : f.userId,
                );
                for (const friendId of friendIds) {
                  io?.to(friendId).emit("presence.offline", {
                    userId: user.id,
                  });
                }
              });
            })
              .catch((err) =>
                Logger.error(
                  `Failed to update user ${user.id} presence to offline:`,
                  err,
                ),
              );
          }
        }
      }
    });
  });

  return httpServer;
}

export async function broadcastRoomActiveUsers(roomId, excludeSocketId) {
  if (!io) return;
  const roomSockets = io.sockets.adapter.rooms.get(roomId);
  const activeUsers = [];
  if (roomSockets) {
    const seenUserIds = new Set();
    const userIdsToFetch = [];
    for (const socketId of roomSockets) {
      if (socketId === excludeSocketId) continue;
      const clientSocket = io.sockets.sockets.get(socketId);
      const u = clientSocket?.user;
      if (u && !seenUserIds.has(u.id)) {
        seenUserIds.add(u.id);
        userIdsToFetch.push(u.id);
      }
    }
    if (userIdsToFetch.length > 0) {
      try {
        const dbUsers = await prisma.user.findMany({
          where: { id: { in: userIdsToFetch } },
          select: { id: true, username: true, name: true, avatar: true },
        });
        activeUsers.push(...dbUsers);
      } catch (err) {
        Logger.error(`Error fetching active users for room ${roomId}:`, err);
      }
    }
  }

  io.to(roomId).emit("room_active_users_update", {
    roomId,
    activeCount: activeUsers.length,
    activeUsers,
  });
}

// Graceful WS Server Shutdown hook
export async function shutdownSocketServer() {
  if (io) {
    Logger.info("Initiating graceful Socket.IO server shutdown...");
    io.close(() => {
      Logger.info("Socket.IO server has been closed.");
    });
  }
}
