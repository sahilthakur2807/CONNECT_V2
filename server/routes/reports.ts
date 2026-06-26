import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const reportsRouter = Router();

// Get reports (admin/moderator/room creators only)
reportsRouter.get('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const isAdminOrSuperAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
  const isCommonModerator = req.user!.role === 'moderator';

  try {
    let whereClause: any = {};
    
    if (!isAdminOrSuperAdmin && !isCommonModerator) {
      // Find rooms created by the user
      const createdRooms = await prisma.room.findMany({
        where: { createdById: req.user!.id },
        select: { id: true }
      });
      const createdRoomIds = createdRooms.map(r => r.id);
      
      if (createdRoomIds.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      whereClause = {
        OR: [
          { roomId: { in: createdRoomIds } },
          { message: { roomId: { in: createdRoomIds } } }
        ]
      };
    }

    const reports = await prisma.report.findMany({
      where: whereClause,
      include: {
        reporter: { select: { id: true, username: true, name: true } },
        reportedUser: { select: { id: true, username: true, name: true } },
        message: true,
        room: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Create report
reportsRouter.post('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const reportSchema = z.object({
    reason: z.string().min(2),
    description: z.string().min(5),
    severity: z.string().optional().default('medium'),
    reportedUserId: z.string().optional(),
    messageId: z.string().optional(),
    roomId: z.string().optional()
  });

  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const report = await prisma.report.create({
      data: {
        ...parsed.data,
        reporterId: req.user!.id
      }
    });
    res.status(201).json(report);
  } catch (error) {
    res.status(500).json({ error: 'Failed to file report' });
  }
});

// Update report (resolve/dismiss)
reportsRouter.patch('/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const reportSchema = z.object({ status: z.string() });
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const report = await prisma.report.findUnique({ where: { id: (req.params.id as string) } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    const isAdminOrSuperAdmin = req.user!.role === 'admin' || req.user!.role === 'superadmin';
    const isCommonModerator = req.user!.role === 'moderator';

    let isRoomCreator = false;
    if (report.roomId) {
      const room = await prisma.room.findUnique({ where: { id: report.roomId } });
      if (room && room.createdById === req.user!.id) {
        isRoomCreator = true;
      }
    } else if (report.messageId) {
      const message = await prisma.message.findUnique({ where: { id: report.messageId } });
      if (message) {
        const room = await prisma.room.findUnique({ where: { id: message.roomId } });
        if (room && room.createdById === req.user!.id) {
          isRoomCreator = true;
        }
      }
    }

    if (!isAdminOrSuperAdmin && !isCommonModerator && !isRoomCreator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await prisma.report.update({
      where: { id: (req.params.id as string) },
      data: { status: parsed.data.status }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});
