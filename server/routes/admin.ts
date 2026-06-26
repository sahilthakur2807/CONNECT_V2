import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const adminRouter = Router();

// Retrieve all system/user settings (superadmin only)
adminRouter.get('/settings', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied: Super Admin only' });
  }

  try {
    const settings = await prisma.systemSetting.findMany();
    // Convert array of key-value objects to a single object
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve system settings' });
  }
});

// Update system/user settings (superadmin only)
adminRouter.post('/settings', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'superadmin') {
    return res.status(403).json({ error: 'Access denied: Super Admin only' });
  }

  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Invalid settings body' });
  }

  try {
    const upserts = Object.entries(updates).map(([key, val]) => {
      return prisma.systemSetting.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) }
      });
    });

    await Promise.all(upserts);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save system settings' });
  }
});
