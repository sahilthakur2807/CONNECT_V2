import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../../../infrastructure/db/PrismaClient.js";
import { authenticateJWT } from "../../../presentation/middlewares/AuthMiddleware.js";

// Ensure uploads directory exists at server root
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only images (jpeg, jpg, png, gif, webp) are allowed"));
  }
});

export function createUserRouter() {
  const router = Router();

  // 1. Upload avatar photo
  router.post("/avatar", authenticateJWT, upload.single("avatar"), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, data: { url: fileUrl } });
    } catch (err) {
      next(err);
    }
  });

  // Helper to decode HTML-escaped slashes from sanitization middleware
  const unescapeUrl = (str) => {
    if (!str) return str;
    return str.replace(/&#x2F;/g, "/");
  };

  // 2. Update profile (name, bio, avatar, banner)
  router.put("/profile", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      name: z.string().max(50).optional(),
      bio: z.string().max(200).optional(),
      avatar: z.string().optional(),
      banner: z.string().optional()
    });

    try {
      const parsed = schema.parse(req.body);
      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          name: parsed.name,
          bio: parsed.bio,
          avatar: parsed.avatar ? unescapeUrl(parsed.avatar) : undefined,
          banner: parsed.banner ? unescapeUrl(parsed.banner) : undefined
        },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          avatar: true,
          bio: true,
          banner: true,
          verified: true,
          badges: true,
          reputation: true,
          role: true,
          createdAt: true
        }
      });
      res.json({ success: true, data: updatedUser });
    } catch (err) {
      next(err);
    }
  });

  // 3. Get profile details (Friendship status, block status, etc.)
  router.get("/:id", authenticateJWT, async (req, res, next) => {
    try {
      const targetUserId = req.params.id;
      const currentUserId = req.user.id;

      // Handle own profile fetch directly
      if (targetUserId === currentUserId) {
        const user = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true,
            banner: true,
            verified: true,
            badges: true,
            reputation: true,
            createdAt: true,
            role: true
          }
        });
        if (!user || user.role === "banned") {
          return res.status(404).json({ success: false, error: "User not found" });
        }
        return res.json({
          success: true,
          data: {
            ...user,
            isBlocked: false,
            friendshipStatus: "none",
            friendshipId: null
          }
        });
      }

      // Check if target user exists
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          name: true,
          avatar: true,
          bio: true,
          banner: true,
          verified: true,
          badges: true,
          reputation: true,
          createdAt: true,
          role: true
        }
      });

      if (!user || user.role === "banned") {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      // Check if current user is blocked by target user
      const blockedBy = await prisma.block.findUnique({
        where: {
          userId_blockedId: {
            userId: targetUserId,
            blockedId: currentUserId
          }
        }
      });

      if (blockedBy) {
        return res.status(403).json({ success: false, error: "Access denied. You have been blocked by this user." });
      }

      // Check if current user blocks target user
      const blocksTarget = await prisma.block.findUnique({
        where: {
          userId_blockedId: {
            userId: currentUserId,
            blockedId: targetUserId
          }
        }
      });

      // Check friendship status
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { userId: currentUserId, friendId: targetUserId },
            { userId: targetUserId, friendId: currentUserId }
          ]
        }
      });

      let friendshipStatus = "none";
      let friendshipId = null;
      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === "accepted") {
          friendshipStatus = "friends";
        } else if (friendship.status === "pending") {
          if (friendship.userId === currentUserId) {
            friendshipStatus = "pending_sent";
          } else {
            friendshipStatus = "pending_received";
          }
        }
      }

      res.json({
        success: true,
        data: {
          ...user,
          isBlocked: !!blocksTarget,
          friendshipStatus,
          friendshipId
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. Get rooms owned by user
  router.get("/:id/rooms-owned", authenticateJWT, async (req, res, next) => {
    try {
      const targetUserId = req.params.id;
      const currentUserId = req.user.id;

      // Check block first (only if viewing another user's rooms)
      if (targetUserId !== currentUserId) {
        const blocked = await prisma.block.findUnique({
          where: {
            userId_blockedId: {
              userId: targetUserId,
              blockedId: currentUserId
            }
          }
        });
        if (blocked) {
          return res.status(403).json({ success: false, error: "Access denied. You have been blocked by this user." });
        }
      }

      const rooms = await prisma.room.findMany({
        where: {
          createdById: targetUserId,
          deleted: false,
          title: { not: "World Chat" }
        },
        include: {
          community: { select: { id: true, name: true } },
          _count: { select: { members: true, messages: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      res.json({ success: true, data: rooms });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const userRouter = createUserRouter();
