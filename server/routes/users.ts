import { Router } from 'express';
import { prisma } from '../db.js';

export const usersRouter = Router();

// Get all users
usersRouter.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true,
        _count: {
          select: { messages: true, rooms: true }
        }
      },
      orderBy: { reputation: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get active users (status online)
usersRouter.get('/active', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'online' },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true
      },
      take: 12
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active users' });
  }
});

// Get user profile by ID
usersRouter.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        verified: true,
        reputation: true,
        badges: true,
        createdAt: true,
        _count: {
          select: { messages: true, rooms: true }
        }
      }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Get user messages
usersRouter.get('/:id/messages', async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { userId: req.params.id, deleted: false },
      include: {
        room: true,
        user: { select: { id: true, username: true, name: true, avatar: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user messages' });
  }
});

// Get user rooms (rooms joined by the user)
usersRouter.get('/:id/rooms', async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        members: {
          some: { userId: req.params.id }
        }
      },
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
    res.status(500).json({ error: 'Failed to fetch user rooms' });
  }
});
