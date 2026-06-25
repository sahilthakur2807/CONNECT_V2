import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const notificationsRouter = Router();

// Get notifications
notificationsRouter.get('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      include: {
        trigger: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark all read
notificationsRouter.post('/read', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Mark single read
notificationsRouter.post('/:id/read', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id, userId: req.user!.id },
      data: { read: true }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});
