import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';
import { io, pushRealtimeNotification } from '../socket.js';

export const roomsRouter = Router();

// Get rooms
roomsRouter.get('/', async (req, res) => {
  const { communityId, category } = req.query;
  const filter: any = {};
  if (communityId) filter.communityId = communityId as string;
  if (category) filter.category = category as string;

  try {
    const rooms = await prisma.room.findMany({
      where: filter,
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get trending rooms
roomsRouter.get('/trending', async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Find rooms with most activity in last 24h
    const rooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        },
        messages: {
          where: { createdAt: { gte: last24h } },
          select: { id: true }
        }
      },
      take: 20
    });

    // Sort by message count
    const trendingRooms = rooms
      .sort((a, b) => {
        const scoreA = a._count.messages;
        const scoreB = b._count.messages;
        if (a.trending && !b.trending) return -1;
        if (!a.trending && b.trending) return 1;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    res.json(trendingRooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trending rooms' });
  }
});

// Get hot rooms (by active members)
roomsRouter.get('/hot', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      },
      take: 20
    });

    const hotRooms = rooms
      .sort((a, b) => {
        const scoreA = a._count.members;
        const scoreB = b._count.members;
        return scoreB - scoreA;
      })
      .slice(0, 10);

    res.json(hotRooms);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hot rooms' });
  }
});

// Get newly created rooms
roomsRouter.get('/new', async (req, res) => {
  try {
    const newRooms = await prisma.room.findMany({
      include: {
        community: true,
        _count: { select: { members: true, messages: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    });
    res.json(newRooms);
  } catch (error) {
    console.error('Fetch new rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch newly created rooms' });
  }
});

// Get room details
roomsRouter.get('/:id', async (req, res) => {
  try {
    const room = await prisma.room.findUnique({
      where: { id: req.params.id },
      include: {
        community: true,
        members: {
          include: { user: true },
          take: 24, // fetch up to 24 members for the active voices section
        },
        _count: {
          select: { members: true, messages: true }
        }
      }
    });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create room
roomsRouter.post('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const roomSchema = z.object({
    title: z.string().min(3),
    description: z.string(),
    category: z.string(),
    tags: z.array(z.string()).optional().default([]),
    communityId: z.string().optional(),
    sourceUrl: z.string().url().optional(),
    imageUrl: z.string().url().optional()
  });

  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const room = await prisma.room.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
        imageUrl: parsed.data.imageUrl || `https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&h=200&fit=crop`
      }
    });

    // Create ActivityLog
    await prisma.activityLog.create({
      data: {
        userId: req.user!.id,
        action: 'CREATE_ROOM',
        details: `Created room "${room.title}"`
      }
    });

    // Auto join room
    await prisma.roomMember.create({
      data: { userId: req.user!.id, roomId: room.id }
    });

    const roomWithCounts = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        community: true,
        _count: {
          select: { members: true, messages: true }
        }
      }
    });

    res.status(201).json(roomWithCounts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Join room
roomsRouter.post('/:id/join', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const roomId = req.params.id;
    const existing = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user!.id, roomId } }
    });

    if (!existing) {
      await prisma.roomMember.create({
        data: { userId: req.user!.id, roomId }
      });
      // Log activity
      await prisma.activity.create({
        data: { userId: req.user!.id, roomId, actionType: 'ROOM_JOINED' }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave room
roomsRouter.post('/:id/leave', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const roomId = req.params.id;
    await prisma.roomMember.delete({
      where: { userId_roomId: { userId: req.user!.id, roomId } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Get messages for a room
roomsRouter.get('/:roomId/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { roomId: req.params.roomId, deleted: false, parentId: null },
      include: {
        user: {
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
        },
        reactions: {
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        },
        replies: {
          where: { deleted: false },
          include: {
            user: {
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
            },
            reactions: {
              include: {
                user: { select: { id: true, username: true } }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create message in room
roomsRouter.post('/:roomId/messages', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const messageSchema = z.object({
    content: z.string().min(1),
    parentId: z.string().optional()
  });

  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const { content, parentId } = parsed.data;
    const roomId = req.params.roomId;

    const message = await prisma.message.create({
      data: {
        content,
        userId: req.user!.id,
        roomId,
        parentId: parentId || null
      },
      include: {
        user: {
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
        },
        reactions: true,
        replies: true
      }
    });

    // Update reputation for posting
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { reputation: { increment: 2 } }
    });

    // Create notification if reply
    if (parentId) {
      const parentMessage = await prisma.message.findUnique({ where: { id: parentId } });
      if (parentMessage && parentMessage.userId !== req.user!.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: parentMessage.userId,
            triggerId: req.user!.id,
            type: 'reply',
            title: 'New Reply',
            body: `${req.user!.username} replied to your message.`,
            roomId,
            referenceId: message.id
          },
          include: { trigger: true }
        });
        pushRealtimeNotification(parentMessage.userId, notification);
      }
    }

    // Broadcast new message via Socket.IO
    if (io) {
      io.to(`room:${roomId}`).emit('new_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
