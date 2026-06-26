import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';
import { io, pushRealtimeNotification, broadcastStatsUpdate } from '../socket.js';

export const messagesRouter = Router();

// Get trending messages for Hot Debates
messagesRouter.get('/trending', async (req, res) => {
  try {
    const last48h = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const messages = await prisma.message.findMany({
      where: { 
        parentId: null,
        deleted: false,
        createdAt: { gte: last48h }
      },
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        room: { select: { id: true, category: true, title: true } },
        _count: {
          select: { replies: true, reactions: true }
        }
      },
      take: 20
    });

    // Sort by heat score: (replies * 3) + (reactions * 1)
    const hotDebates = messages
      .sort((a, b) => {
        const scoreA = (a._count.replies * 3) + (a._count.reactions);
        const scoreB = (b._count.replies * 3) + (b._count.reactions);
        return scoreB - scoreA;
      })
      .slice(0, 5);

    res.json(hotDebates);
  } catch (error) {
    console.error('Hot debates fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch trending messages' });
  }
});

// Edit message
messagesRouter.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const messageSchema = z.object({ content: z.string().min(1) });
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const message = await prisma.message.findUnique({ where: { id: (req.params.id as string) } });
    if (!message) return res.status(404).json({ error: 'Message not found' });
    const isAdminOrSuperAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
    if (message.userId !== req.user!.id && !isAdminOrSuperAdmin) {
      return res.status(403).json({ error: 'Unauthorized to edit this message' });
    }

    const updated = await prisma.message.update({
      where: { id: (req.params.id as string) },
      data: { content: parsed.data.content, edited: true },
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

    // Broadcast updated message to room channel
    if (io) {
      io.to(`room:${updated.roomId}`).emit('update_message', updated);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete message
messagesRouter.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const message = await prisma.message.findUnique({ where: { id: (req.params.id as string) } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const room = await prisma.room.findUnique({ where: { id: message.roomId } });
    const isRoomCreator = room?.createdById === req.user!.id;
    const isCommonModerator = req.user!.role === 'moderator';
    const isAdminOrSuperAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';

    if (message.userId !== req.user!.id && !isAdminOrSuperAdmin && !isCommonModerator && !isRoomCreator) {
      return res.status(403).json({ error: 'Unauthorized to delete this message' });
    }

    await prisma.message.update({
      where: { id: (req.params.id as string) },
      data: { deleted: true }
    });

    // Broadcast message deletion to room channel
    if (io) {
      io.to(`room:${message.roomId}`).emit('delete_message', (req.params.id as string));
    }

    broadcastStatsUpdate();
    const messageCount = await prisma.message.count({ where: { roomId: message.roomId, deleted: false } });
    if (io) {
      io.emit('room_stats_update', { roomId: message.roomId, messageCount });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Create reply (same as posting with parentId)
messagesRouter.post('/:messageId/replies', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const messageSchema = z.object({ content: z.string().min(1) });
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const parentId = (req.params.messageId as string);
    const parentMessage = await prisma.message.findUnique({ where: { id: parentId } });
    if (!parentMessage) return res.status(404).json({ error: 'Parent message not found' });

    const message = await prisma.message.create({
      data: {
        content: parsed.data.content,
        userId: req.user!.id,
        roomId: parentMessage.roomId,
        parentId
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
        reactions: true
      }
    });

    // Update reputation
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { reputation: { increment: 2 } }
    });

    // Create Notification
    if (parentMessage.userId !== req.user!.id) {
      const notification = await prisma.notification.create({
        data: {
          userId: parentMessage.userId,
          triggerId: req.user!.id,
          type: 'reply',
          title: 'New Reply',
          body: `${req.user!.username} replied to your message.`,
          roomId: parentMessage.roomId,
          referenceId: message.id
        },
        include: { trigger: true }
      });
      pushRealtimeNotification(parentMessage.userId, notification);
    }

    if (io) {
      io.to(`room:${parentMessage.roomId}`).emit('new_message', message);
    }

    broadcastStatsUpdate();
    const messageCount = await prisma.message.count({ where: { roomId: parentMessage.roomId, deleted: false } });
    if (io) {
      io.emit('room_stats_update', { roomId: parentMessage.roomId, messageCount });
    }

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reply' });
  }
});

// Toggle Reaction
messagesRouter.post('/:messageId/reactions', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const reactionSchema = z.object({ emoji: z.string() });
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const { emoji } = parsed.data;
  const messageId = (req.params.messageId as string);

  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ error: 'Message not found' });

    const existing = await prisma.reaction.findUnique({
      where: {
        userId_messageId_emoji: {
          userId: req.user!.id,
          messageId,
          emoji
        }
      }
    });

    if (existing) {
      await prisma.reaction.delete({
        where: { id: existing.id }
      });
    } else {
      await prisma.reaction.create({
        data: {
          emoji,
          userId: req.user!.id,
          messageId
        }
      });

      // Notify message creator
      if (message.userId !== req.user!.id) {
        const notification = await prisma.notification.create({
          data: {
            userId: message.userId,
            triggerId: req.user!.id,
            type: 'reaction',
            title: 'Message Reacted',
            body: `${req.user!.username} reacted ${emoji} to your message.`,
            roomId: message.roomId,
            referenceId: message.id
          },
          include: { trigger: true }
        });
        pushRealtimeNotification(message.userId, notification);
      }
    }

    // Refetch the full message to broadcast with updated reactions
    const updatedMessage = await prisma.message.findUnique({
      where: { id: messageId },
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
          }
        }
      }
    });

    if (updatedMessage && io) {
      io.to(`room:${updatedMessage.roomId}`).emit('update_message', updatedMessage);
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
});
