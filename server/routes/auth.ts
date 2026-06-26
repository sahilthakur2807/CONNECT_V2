import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { prisma } from '../db.js';
import { authenticateJWT, optionalJWT, type AuthenticatedRequest } from '../middleware.js';
import { broadcastStatsUpdate } from '../socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || 'newsconnect-secret-key-change-in-production';

// ── Avatar upload config ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'profilepic');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Not an image! Please upload an image.'));
  }
});

export const authRouter = Router();

// Register
authRouter.post('/register', async (req, res) => {
  const schema = z.object({
    username: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid inputs: ' + parsed.error.message });

  const { username, email, password } = parsed.data;
  try {
    const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username, email, password: hashedPassword,
        name: username, role: 'user', status: 'online',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        reputation: 10, badges: ['Early Member']
      }
    });

    broadcastStatsUpdate();

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    const { password: _, ...userOut } = user;
    res.json({ token, user: userOut });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
authRouter.post('/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid email or password format' });

  const { email, password } = parsed.data;
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { _count: { select: { messages: true, rooms: true } } }
    });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

    await prisma.user.update({ where: { id: user.id }, data: { status: 'online' } });

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    const { password: _, ...userOut } = user;
    res.json({ token, user: userOut });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
authRouter.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { _count: { select: { messages: true, rooms: true, createdRooms: true } } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password: _, ...userOut } = user;
    res.json(userOut);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update profile
authRouter.patch('/me', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().optional(),
    avatar: z.string().url().optional(),
    bio: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  try {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: parsed.data,
      include: { _count: { select: { messages: true, rooms: true } } }
    });
    const { password: _, ...userOut } = updated;
    res.json(userOut);
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload avatar
authRouter.post('/avatar', authenticateJWT, upload.single('avatar'), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const avatarUrl = `/uploads/profilepic/${req.file.filename}`;
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatar: avatarUrl },
      include: { _count: { select: { messages: true, rooms: true } } }
    });
    const { password: _, ...userOut } = updated;
    res.json(userOut);
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

// Logout
authRouter.post('/logout', optionalJWT, async (req: AuthenticatedRequest, res) => {
  if (req.user) {
    try {
      await prisma.user.update({ where: { id: req.user.id }, data: { status: 'offline' } });
    } catch { /* ignore */ }
  }
  res.json({ success: true });
});
