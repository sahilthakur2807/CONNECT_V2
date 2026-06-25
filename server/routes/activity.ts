import { Router } from 'express';
import { prisma } from '../db.js';

export const activityRouter = Router();

// Get recent activity
activityRouter.get('/recent', async (req, res) => {
  try {
    const activities = await prisma.activity.findMany({
      include: {
        user: { select: { id: true, username: true, name: true, avatar: true } },
        room: { select: { id: true, title: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});
