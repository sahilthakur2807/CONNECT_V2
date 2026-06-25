import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import type express from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'newsconnect-secret-key-change-in-production';

// Map of userId → Set of socket IDs for real-time notification routing
export const userSockets = new Map<string, Set<string>>();

export let io: SocketServer;

export function createSocketServer(app: express.Application) {
  const httpServer = createServer(app);
  io = new SocketServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  // Socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next();
    try {
      const decoded = jwt.verify(token as string, JWT_SECRET) as { id: string; username: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (user) {
      if (!userSockets.has(user.id)) userSockets.set(user.id, new Set());
      userSockets.get(user.id)!.add(socket.id);
    }

    socket.on('join_room', (roomId: string) => socket.join(`room:${roomId}`));
    socket.on('leave_room', (roomId: string) => socket.leave(`room:${roomId}`));

    socket.on('disconnect', () => {
      if (user) {
        const sockets = userSockets.get(user.id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) userSockets.delete(user.id);
        }
      }
    });
  });

  return httpServer;
}

/** Push a real-time notification to all sockets belonging to userId. */
export function pushRealtimeNotification(userId: string, notification: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    for (const socketId of sockets) {
      io.to(socketId).emit('notification', notification);
    }
  }
}
