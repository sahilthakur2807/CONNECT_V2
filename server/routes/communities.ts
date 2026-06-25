import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authenticateJWT, type AuthenticatedRequest } from '../middleware.js';

export const communitiesRouter = Router();

// Get all communities
communitiesRouter.get('/', async (req, res) => {
  try {
    const communities = await prisma.community.findMany({
      include: { _count: { select: { members: true, rooms: true } } }
    });
    res.json(communities);
  } catch {
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// Get community by ID
communitiesRouter.get('/:id', async (req, res) => {
  try {
    const community = await prisma.community.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { members: true, rooms: true } } }
    });
    if (!community) return res.status(404).json({ error: 'Community not found' });
    res.json(community);
  } catch {
    res.status(500).json({ error: 'Failed to fetch community' });
  }
});

// Create community
communitiesRouter.post('/', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2),
    description: z.string(),
    category: z.string().default('General'),
    imageUrl: z.string().url().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const existing = await prisma.community.findUnique({ where: { name: parsed.data.name } });
    if (existing) return res.status(400).json({ error: 'Community with this name already exists' });

    const community = await prisma.community.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
        imageUrl: parsed.data.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${parsed.data.name}`
      }
    });

    // Creator auto-joins as admin
    await prisma.communityMember.create({
      data: { userId: req.user!.id, communityId: community.id, role: 'admin' }
    });

    res.status(201).json(community);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create community' });
  }
});

// Join community
communitiesRouter.post('/:id/join', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const communityId = req.params.id;
    const existing = await prisma.communityMember.findUnique({
      where: { userId_communityId: { userId: req.user!.id, communityId } }
    });
    if (existing) return res.status(400).json({ error: 'Already a member' });

    await prisma.communityMember.create({ data: { userId: req.user!.id, communityId } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to join community' });
  }
});

// Leave community
communitiesRouter.post('/:id/leave', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const communityId = req.params.id;
    await prisma.communityMember.delete({
      where: { userId_communityId: { userId: req.user!.id, communityId } }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to leave community' });
  }
});

// Get community members
communitiesRouter.get('/:id/members', async (req, res) => {
  try {
    const members = await prisma.communityMember.findMany({
      where: { communityId: req.params.id },
      include: {
        user: {
          select: {
            id: true, username: true, name: true, avatar: true,
            role: true, status: true, verified: true, reputation: true, badges: true
          }
        }
      }
    });
    res.json(members.map(m => m.user));
  } catch {
    res.status(500).json({ error: 'Failed to fetch community members' });
  }
});
