import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const reportsRouter = Router();

// Get reports (admin/moderator only)
reportsRouter.get('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  if (req.user!.role !== 'admin' && req.user!.role !== 'moderator') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const reports = await prisma.report.findMany({
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
  if (req.user!.role !== 'admin' && req.user!.role !== 'moderator') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reportSchema = z.object({ status: z.string() });
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const updated = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});
