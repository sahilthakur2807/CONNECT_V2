import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const extensionRouter = Router();

const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
  } catch (e) {
    return url;
  }
};

// Extension Lookup
extensionRouter.post('/rooms/lookup', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const normalized_url = normalizeUrl(url);

  try {
    const article = await prisma.article.findUnique({
      where: { normalized_url },
      include: {
        rooms: {
          include: {
            _count: {
              select: { members: true, messages: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (article && article.rooms.length > 0) {
      return res.json({ room: article.rooms[0] });
    }

    res.json({ room: null });
  } catch (error) {
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// Extension Create Room
extensionRouter.post('/rooms', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { url, title, description, source } = req.body;
  if (!url || !title) return res.status(400).json({ error: 'URL and title are required' });

  const normalized_url = normalizeUrl(url);

  try {
    let article = await prisma.article.findUnique({ where: { normalized_url } });
    if (!article) {
      article = await prisma.article.create({
        data: {
          url,
          normalized_url,
          title,
          source
        }
      });
    }

    const titleParts = title.split(/::|\||—/).map((s: string) => s.trim()).filter(Boolean);
    const mainTitle = titleParts[0] || title;
    const extractedTags = titleParts.slice(1).map((tag: string) => tag.replace(/^#/, ''));

    const room = await prisma.room.create({
      data: {
        title: mainTitle,
        description: description || `Discussion room for: ${mainTitle}`,
        category: 'Article',
        tags: extractedTags,
        sourceUrl: url,
        articleId: article.id,
        createdById: req.user!.id
      }
    });

    // Create activity record
    await prisma.activity.create({
      data: {
        userId: req.user!.id,
        roomId: room.id,
        actionType: 'ROOM_CREATED'
      }
    });
    
    // Add user as member
    await prisma.roomMember.create({
      data: {
        userId: req.user!.id,
        roomId: room.id
      }
    });

    const roomWithCounts = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        _count: {
          select: { members: true, messages: true }
        }
      }
    });

    res.json({ room: roomWithCounts });
  } catch (error) {
    res.status(500).json({ error: 'Room creation failed' });
  }
});

// Extension Join Room
extensionRouter.post('/rooms/:roomId/join', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { roomId } = req.params;

  try {
    const existingMember = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: req.user!.id, roomId } }
    });

    if (!existingMember) {
      await prisma.roomMember.create({
        data: {
          userId: req.user!.id,
          roomId
        }
      });
      
      await prisma.activity.create({
        data: {
          userId: req.user!.id,
          roomId,
          actionType: 'ROOM_JOINED'
        }
      });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Join failed' });
  }
});
