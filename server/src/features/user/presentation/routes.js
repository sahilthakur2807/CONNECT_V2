import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../../../infrastructure/db/PrismaClient.js";
import { Hash } from "../../../shared/utils/Hash.js";
import { ForbiddenError } from "../../../shared/errors/AppError.js";
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
  router.post("/avatar", authenticateJWT, (req, res, next) => {
    upload.single("avatar")(req, res, (err) => {
      if (err) {
        console.error("Avatar upload library error:", err);
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: "File is too large. Maximum size allowed is 10MB."
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        console.error("Avatar upload error: No file in request");
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, data: { url: fileUrl } });
    });
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

  // 2b. Update credentials (email and/or password)
  router.put("/profile/credentials", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      email: z.string().email().optional(),
      password: z.string().min(8, "Password must be at least 8 characters long").optional()
    });

    try {
      const parsed = schema.parse(req.body);
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const updateData = {};

      if (parsed.email && parsed.email !== user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: parsed.email }
        });
        if (existing) {
          return res.status(400).json({ success: false, error: "Email is already in use by another citizen" });
        }
        updateData.email = parsed.email;
      }

      if (parsed.password) {
        updateData.password = await Hash.hash(parsed.password);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: "No changes provided" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
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

      res.json({ success: true, data: updatedUser, message: "Credentials updated successfully" });
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
            role: true,
            status: true,
            isPaused: true,
            isDeleted: true
          }
        });
        if (!user || user.isDeleted) {
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
          role: true,
          status: true,
          isPaused: true,
          isDeleted: true
        }
      });

      const activeBan = await prisma.moderationAction.findFirst({
        where: {
          userId: targetUserId,
          communityId: null,
          type: "ban",
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (!user || user.isDeleted || activeBan) {
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

      const isAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(req.user.role);
      const userPaused = user.isPaused;
      res.json({
        success: true,
        data: {
          ...user,
          status: userPaused && !isAdmin ? "offline" : user.status,
          isPaused: userPaused ? (isAdmin ? true : false) : false,
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

  // 5. Toggle Pause Account
  router.post("/pause", authenticateJWT, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { isPaused: true }
      });
      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      const newPausedState = !user.isPaused;
      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          isPaused: newPausedState,
          status: newPausedState ? "paused" : "online"
        },
        select: {
          id: true,
          isPaused: true,
          status: true
        }
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  });

  // 6. Delete Account (Cascade or Anonymize)
  router.post("/delete", authenticateJWT, async (req, res, next) => {
    const schema = z.object({
      mode: z.enum(["cascade", "anonymize"])
    });

    try {
      const parsed = schema.parse(req.body);
      const userId = req.user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      if (parsed.mode === "cascade") {
        await prisma.$transaction(async (tx) => {
          // Delete all rooms created by this user
          await tx.room.deleteMany({
            where: { createdById: userId }
          });

          // Delete the user record
          await tx.user.delete({
            where: { id: userId }
          });
        });

        res.json({ success: true, message: "Account and all created rooms deleted successfully." });
      } else {
        await prisma.$transaction(async (tx) => {
          // 1. Delete friendships
          await tx.friendship.deleteMany({
            where: { OR: [{ userId }, { friendId: userId }] }
          });

          // 2. Delete room memberships
          await tx.roomMember.deleteMany({
            where: { userId }
          });

          // 3. Delete community memberships
          await tx.communityMember.deleteMany({
            where: { userId }
          });

          // 4. Delete blocks
          await tx.block.deleteMany({
            where: { OR: [{ userId }, { blockedId: userId }] }
          });

          // 5. Delete existing notifications (received by this user or triggered by this user)
          await tx.notification.deleteMany({
            where: { OR: [{ userId }, { triggerId: userId }] }
          });

          // 6. Delete OAuth accounts
          await tx.oAuthAccount.deleteMany({
            where: { userId }
          });

          // 7. Anonymize user details to release email & username
          const anonymizedUsername = `deleted_user_${userId.substring(4)}`;
          await tx.user.update({
            where: { id: userId },
            data: {
              email: `deleted_${userId}@connect.com`,
              username: anonymizedUsername,
              password: "",
              name: "Deleted Citizen",
              avatar: null,
              bio: "This account has been deleted.",
              banner: "from-zinc-800 to-zinc-950",
              badges: [],
              reputation: 0,
              isDeleted: true,
              isPaused: false,
              status: "offline"
            }
          });

          // 8. Revoke sessions
          await tx.session.deleteMany({
            where: { userId }
          });

          // 9. Send notification to all moderators/admins
          const moderators = await tx.user.findMany({
            where: {
              role: { in: ["moderator", "admin"] }
            }
          });

          for (const mod of moderators) {
            await tx.notification.create({
              data: {
                type: "system.user_deleted",
                title: "User Profile Deleted",
                body: `@${user.username} has deleted their profile. The rooms they created have been orphaned. Please review and assume responsibility.`,
                userId: mod.id,
                triggerId: userId,
              }
            });
          }
        });

        res.json({ success: true, message: "Account profile deleted. Data preserved." });
      }
    } catch (err) {
      next(err);
    }
  });

  // 8. PUT /:id/role - Promote/demote user platform role (SUPER_ADMIN only)
  router.put("/:id/role", authenticateJWT, async (req, res, next) => {
    const targetUserId = req.params.id;
    const actorUserId = req.user.id;
    const actorRole = req.user.role;

    if (actorRole !== "SUPER_ADMIN") {
      return next(new ForbiddenError("Only SUPER_ADMIN can promote or demote platform roles"));
    }

    const schema = z.object({
      role: z.enum(["PLATFORM_ADMIN", "PLATFORM_MOD", "MEMBER"])
    });

    try {
      const parsed = schema.parse(req.body);
      const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!targetUser) {
        return res.status(404).json({ success: false, error: "User not found" });
      }

      if (targetUser.role === "SUPER_ADMIN") {
        return res.status(400).json({ success: false, error: "SUPER_ADMIN accounts cannot be altered" });
      }

      const updatedUser = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: targetUserId },
          data: { role: parsed.role },
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

        await tx.auditLog.create({
          data: {
            action: "user.role_change",
            targetId: targetUserId,
            targetType: "User",
            details: `Promoted/demoted User ${targetUserId} (@${u.username}) from ${targetUser.role} to ${parsed.role}`,
            actorId: actorUserId
          }
        });

        return u;
      });

      res.json({ success: true, data: updatedUser, message: `User role successfully updated to ${parsed.role}` });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export const userRouter = createUserRouter();
