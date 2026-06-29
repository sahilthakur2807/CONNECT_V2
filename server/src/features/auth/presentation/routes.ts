import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateJWT, optionalJWT, type AuthenticatedRequest } from '@presentation/middlewares/AuthMiddleware.js';
import { RegisterCommand, LoginCommand, UpdateProfileCommand, UpdateAvatarCommand, LogoutCommand } from '../application/commands/AuthCommands.js';
import type { RegisterHandler, LoginHandler, UpdateProfileHandler, UpdateAvatarHandler, LogoutHandler } from '../application/commands/AuthCommands.js';
import { prisma } from '@infrastructure/db/PrismaClient.js';

// Setup file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'profilepic');
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

export function createAuthRouter(
  registerHandler: RegisterHandler,
  loginHandler: LoginHandler,
  updateProfileHandler: UpdateProfileHandler,
  updateAvatarHandler: UpdateAvatarHandler,
  logoutHandler: LogoutHandler
): Router {
  const router = Router();

  // Register
  router.post('/register', async (req, res, next) => {
    const schema = z.object({
      username: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid inputs: ' + parsed.error.message });
    }

    try {
      const command = new RegisterCommand(parsed.data.username, parsed.data.email, parsed.data.password);
      const result = await registerHandler.execute(command);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Login
  router.post('/login', async (req, res, next) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid email or password format' });
    }

    try {
      const command = new LoginCommand(parsed.data.email, parsed.data.password);
      const result = await loginHandler.execute(command);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // Get Current User
  router.get('/me', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        include: { _count: { select: { messages: true, rooms: true, createdRooms: true } } }
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      const { password: _, ...userOut } = user;
      res.json(userOut);
    } catch (err) {
      next(err);
    }
  });

  // Update Profile
  router.patch('/me', authenticateJWT, async (req: AuthenticatedRequest, res, next) => {
    const schema = z.object({
      name: z.string().optional(),
      avatar: z.string().url().optional(),
      bio: z.string().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    try {
      const command = new UpdateProfileCommand(
        req.user!.id,
        parsed.data.name,
        parsed.data.avatar,
        parsed.data.bio
      );
      const userOut = await updateProfileHandler.execute(command);
      res.json(userOut);
    } catch (err) {
      next(err);
    }
  });

  // Upload Avatar
  router.post('/avatar', authenticateJWT, upload.single('avatar'), async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const avatarUrl = `/uploads/profilepic/${req.file.filename}`;
      const command = new UpdateAvatarCommand(req.user!.id, avatarUrl);
      const userOut = await updateAvatarHandler.execute(command);
      res.json(userOut);
    } catch (err) {
      next(err);
    }
  });

  // Logout
  router.post('/logout', optionalJWT, async (req: AuthenticatedRequest, res, next) => {
    try {
      const command = new LogoutCommand(req.user?.id);
      await logoutHandler.execute(command);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
