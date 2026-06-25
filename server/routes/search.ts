import { Router } from 'express';
import { prisma } from '../db.js';

export const searchRouter = Router();

// Global search
searchRouter.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json({ rooms: [], users: [], messages: [] });

  try {
    const [rooms, users, messages] = await Promise.all([
      prisma.room.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
          community: true,
          _count: { select: { members: true, messages: true } }
        },
        take: 10
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { username: { contains: q, mode: 'insensitive' } }
          ]
        },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          verified: true,
          reputation: true,
          badges: true
        },
        take: 10
      }),
      prisma.message.findMany({
        where: {
          content: { contains: q, mode: 'insensitive' },
          deleted: false
        },
        include: {
          user: {
            select: { id: true, username: true, avatar: true }
          },
          room: true
        },
        take: 10
      })
    ]);

    res.json({ rooms, users, messages });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});
