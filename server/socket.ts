import { Server as SocketServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import type express from 'express';
import { prisma } from './db.js';
import { sanitizeUserForClient } from './middleware.js';

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
      const decoded = jwt.verify(token as string, JWT_SECRET) as { id: string; username: string; role: string };
      (socket as any).user = decoded;
      next();
    } catch {
      next();
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    if (user) {
      const isFirstConnection = !userSockets.has(user.id);
      if (isFirstConnection) {
        userSockets.set(user.id, new Set());
        
        // Update database to online and broadcast to friends
        prisma.user.update({
          where: { id: user.id },
          data: { status: 'online' }
        }).then(async (dbUser) => {
          // Trigger stats update since active count changed
          broadcastStatsUpdate();

          const friendships = await prisma.friendship.findMany({
            where: {
              OR: [
                { userId: user.id },
                { friendId: user.id }
              ]
            },
            include: {
              user: true,
              friend: true
            }
          });
          
          for (const f of friendships) {
            const friend = f.userId === user.id ? f.friend : f.user;
            const friendId = friend.id;
            const sockets = userSockets.get(friendId);
            if (sockets) {
              const sanitizedMe = sanitizeUserForClient(dbUser, friend.role);
              for (const socketId of sockets) {
                io.to(socketId).emit('friend_online', {
                  id: sanitizedMe.id,
                  username: sanitizedMe.username,
                  name: sanitizedMe.name,
                  avatar: sanitizedMe.avatar,
                  badges: sanitizedMe.badges,
                  status: 'online',
                  role: sanitizedMe.role
                });
              }
            }
          }
        }).catch(() => {});
      }
      userSockets.get(user.id)!.add(socket.id);
    }

    socket.on('join_room', async (roomId: string) => {
      socket.join(`room:${roomId}`);
      if (user) {
        await addUserToRoom(roomId, user.id, socket.id);
      }
    });

    socket.on('leave_room', async (roomId: string) => {
      socket.leave(`room:${roomId}`);
      if (user) {
        await removeSocketFromRoom(roomId, user.id, socket.id);
      }
    });

    socket.on('disconnect', async () => {
      if (user) {
        await removeSocketFromAllRooms(user.id, socket.id);
        const sockets = userSockets.get(user.id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSockets.delete(user.id);

            // Update database to offline and broadcast to friends
            prisma.user.update({
              where: { id: user.id },
              data: { status: 'offline' }
            }).then(async (dbUser) => {
              // Trigger stats update since active count changed
              broadcastStatsUpdate();

              const friendships = await prisma.friendship.findMany({
                where: {
                  OR: [
                    { userId: user.id },
                    { friendId: user.id }
                  ]
                }
              });
              const friendIds = friendships.map(f => f.userId === user.id ? f.friendId : f.userId);
              
              for (const friendId of friendIds) {
                const sockets = userSockets.get(friendId);
                if (sockets) {
                  for (const socketId of sockets) {
                    io.to(socketId).emit('friend_offline', { userId: user.id });
                  }
                }
              }
            }).catch(() => {});
          }
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

/** Broadcast friend connection to either user if already online */
export async function handleFriendAdded(userId: string, friendId: string) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const friend = await prisma.user.findUnique({ where: { id: friendId } });
    if (!user || !friend) return;

    // If friend is online, send friend info to user
    if (userSockets.has(friendId)) {
      const userSocketsSet = userSockets.get(userId);
      if (userSocketsSet) {
        const sanitizedFriend = sanitizeUserForClient(friend, user.role);
        for (const socketId of userSocketsSet) {
          io.to(socketId).emit('friend_online', {
            id: sanitizedFriend.id,
            username: sanitizedFriend.username,
            name: sanitizedFriend.name,
            avatar: sanitizedFriend.avatar,
            badges: sanitizedFriend.badges,
            status: sanitizedFriend.status,
            role: sanitizedFriend.role
          });
        }
      }
    }

    // If user is online, send user info to friend
    if (userSockets.has(userId)) {
      const friendSocketsSet = userSockets.get(friendId);
      if (friendSocketsSet) {
        const sanitizedUser = sanitizeUserForClient(user, friend.role);
        for (const socketId of friendSocketsSet) {
          io.to(socketId).emit('friend_online', {
            id: sanitizedUser.id,
            username: sanitizedUser.username,
            name: sanitizedUser.name,
            avatar: sanitizedUser.avatar,
            badges: sanitizedUser.badges,
            status: sanitizedUser.status,
            role: sanitizedUser.role
          });
        }
      }
    }
  } catch (e) { /* ignore */ }
}

/** Broadcast real-time platform statistics to all connected clients */
export async function broadcastStatsUpdate() {
  try {
    const [totalUsers, totalRooms, totalMessages, totalCommunities, activeUsers] = await Promise.all([
      prisma.user.count(),
      prisma.room.count(),
      prisma.message.count({ where: { deleted: false } }),
      prisma.community.count(),
      prisma.user.count({ where: { status: 'online' } })
    ]);

    // Generate last 7 days chart data
    const chartData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date.setHours(0,0,0,0));
      const endOfDay = new Date(date.setHours(23,59,59,999));
      
      const [dayMessages, dayUsers] = await Promise.all([
        prisma.message.count({
          where: { createdAt: { gte: startOfDay, lte: endOfDay }, deleted: false }
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfDay, lte: endOfDay } }
        })
      ]);
      
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      chartData.push({
        day: days[startOfDay.getDay()],
        messages: dayMessages,
        users: dayUsers
      });
    }

    if (io) {
      io.emit('stats_update', {
        totalUsers,
        totalRooms,
        totalMessages,
        totalCommunities,
        activeUsers,
        chartData
      });
    }
  } catch (e) {
    console.error('Failed to broadcast stats update:', e);
  }
}

// Map of roomId → Map of userId → { user: any; sockets: Set<string> }
export const roomActiveUsers = new Map<string, Map<string, { user: any; sockets: Set<string> }>>();

export function getRoomActiveCount(roomId: string): number {
  const activeMap = roomActiveUsers.get(roomId);
  return activeMap ? activeMap.size : 0;
}

export async function addUserToRoom(roomId: string, userId: string, socketId: string) {
  if (!roomActiveUsers.has(roomId)) {
    roomActiveUsers.set(roomId, new Map());
  }
  const activeMap = roomActiveUsers.get(roomId)!;
  if (!activeMap.has(userId)) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          verified: true,
          role: true,
          reputation: true,
          badges: true
        }
      });
      if (dbUser) {
        activeMap.set(userId, { user: dbUser, sockets: new Set([socketId]) });
      }
    } catch (e) {
      console.error(e);
    }
  } else {
    activeMap.get(userId)!.sockets.add(socketId);
  }

  await broadcastActiveUsersInRoom(roomId);
}

export async function removeSocketFromRoom(roomId: string, userId: string, socketId: string) {
  const activeMap = roomActiveUsers.get(roomId);
  if (!activeMap) return;

  const userEntry = activeMap.get(userId);
  if (userEntry) {
    userEntry.sockets.delete(socketId);
    if (userEntry.sockets.size === 0) {
      activeMap.delete(userId);
    }
  }

  if (activeMap.size === 0) {
    roomActiveUsers.delete(roomId);
  }

  await broadcastActiveUsersInRoom(roomId);
}

export async function removeSocketFromAllRooms(userId: string, socketId: string) {
  for (const [roomId, activeMap] of roomActiveUsers.entries()) {
    const userEntry = activeMap.get(userId);
    if (userEntry && userEntry.sockets.has(socketId)) {
      userEntry.sockets.delete(socketId);
      if (userEntry.sockets.size === 0) {
        activeMap.delete(userId);
      }
      if (activeMap.size === 0) {
        roomActiveUsers.delete(roomId);
      }
      await broadcastActiveUsersInRoom(roomId);
    }
  }
}

export async function broadcastActiveUsersInRoom(roomId: string) {
  const activeMap = roomActiveUsers.get(roomId);
  const rawList = activeMap ? Array.from(activeMap.values()).map(item => item.user) : [];
  const activeCount = rawList.length;

  if (io) {
    io.emit('room_stats_update', { roomId, activeNow: activeCount });

    const roomSockets = await io.in(`room:${roomId}`).fetchSockets();
    for (const clientSocket of roomSockets) {
      const requester = (clientSocket as any).user;
      const requesterRole = requester?.role || 'user';
      const sanitizedList = rawList.map(u => sanitizeUserForClient(u, requesterRole));
      clientSocket.emit('room_active_users_update', sanitizedList);
    }
  }
}
