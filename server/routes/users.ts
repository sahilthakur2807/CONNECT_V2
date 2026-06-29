import { Router } from 'express';
import { prisma } from '../db.js';
import { authenticateJWT, optionalJWT, type AuthenticatedRequest } from '../middleware.js';
import { handleFriendAdded, broadcastStatsUpdate, getRoomActiveCount } from '../socket.js';

export const usersRouter = Router();

// Helper to attach correct non-deleted message counts and active users counts to rooms
async function attachMessageCounts(rooms: any[], userId?: string) {
  if (rooms.length === 0) return rooms;
  const roomIds = rooms.map(r => r.id);
  const messageCounts = await prisma.message.groupBy({
    by: ['roomId'],
    where: {
      roomId: { in: roomIds },
      deleted: false
    },
    _count: {
      id: true
    }
  });

  const countsMap = new Map<string, number>(
    messageCounts.map(c => [c.roomId, c._count.id])
  );

  const joinedRoomIds = new Set<string>();
  if (userId) {
    const memberships = await prisma.roomMember.findMany({
      where: {
        userId,
        roomId: { in: roomIds }
      },
      select: { roomId: true }
    });
    memberships.forEach(m => joinedRoomIds.add(m.roomId));
  }

  return rooms.map(r => ({
    ...r,
    activeNow: getRoomActiveCount(r.id),
    isJoined: userId ? joinedRoomIds.has(r.id) : false,
    _count: {
      ...r._count,
      messages: countsMap.get(r.id) || 0
    }
  }));
}

// Get all users (excl. admin/superadmin for normal users)
usersRouter.get('/', optionalJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const isRequesterAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const filter = isRequesterAdmin ? {} : { role: { notIn: ['admin', 'superadmin'] } };

    const users = await prisma.user.findMany({
      where: filter,
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

// Get active users (status online, excl. admin/superadmin for normal users)
usersRouter.get('/active', optionalJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const isRequesterAdmin = req.user?.role === 'admin' || req.user?.role === 'superadmin';
    const filter = isRequesterAdmin 
      ? { status: 'online' } 
      : { status: 'online', role: { notIn: ['admin', 'superadmin'] } };

    const users = await prisma.user.findMany({
      where: filter,
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

// Get all friends (with real-time online/offline status)
usersRouter.get('/active-friends', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user!.id },
          { friendId: req.user!.id }
        ]
      },
      include: {
        user: true,
        friend: true
      }
    });

    const friendsList = friendships
      .map(f => f.userId === req.user!.id ? f.friend : f.user)
      .map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        avatar: u.avatar,
        badges: u.badges,
        status: u.status,
        role: u.role
      }))
      .sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        return (a.name || a.username).localeCompare(b.name || b.username);
      });

    res.json(friendsList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends list' });
  }
});

// Search users by username (excl. current user and admin)
usersRouter.get('/search-by-username', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { q } = req.query;
  if (!q || typeof q !== 'string') return res.json([]);

  try {
    const matchedUsers = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        id: { not: req.user!.id },
        role: { not: 'admin' }
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        badges: true
      },
      take: 10
    });

    // Check existing friendships
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { userId: req.user!.id },
          { friendId: req.user!.id }
        ]
      }
    });

    const friendIds = new Set(friendships.map(f => f.userId === req.user!.id ? f.friendId : f.userId));

    const result = matchedUsers.map(u => ({
      ...u,
      isFriend: friendIds.has(u.id)
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Add friend
usersRouter.post('/add-friend', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ error: 'friendId is required' });
  if (friendId === req.user!.id) return res.status(400).json({ error: 'Cannot add yourself as a friend' });

  try {
    // Check if user exists
    const friend = await prisma.user.findUnique({ where: { id: friendId } });
    if (!friend) return res.status(404).json({ error: 'User not found' });
    if (friend.role === 'admin') return res.status(400).json({ error: 'Cannot add site admin as a friend' });

    // Check if already friends
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: req.user!.id, friendId },
          { userId: friendId, friendId: req.user!.id }
        ]
      }
    });

    if (existing) return res.status(400).json({ error: 'Already friends' });

    await prisma.friendship.create({
      data: {
        userId: req.user!.id,
        friendId
      }
    });

    // Realtime status sync
    await handleFriendAdded(req.user!.id, friendId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// Get user profile by ID
usersRouter.get('/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req.params.id as string) },
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
          select: { messages: true, rooms: true, createdRooms: true }
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
      where: { userId: (req.params.id as string), deleted: false },
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
          some: { userId: (req.params.id as string) }
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
    res.json(await attachMessageCounts(rooms, (req as any).user?.id));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user rooms' });
  }
});

// Update user role (admin/superadmin only)
usersRouter.patch('/:id/role', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  const validRoles = ['user', 'moderator', 'admin', 'superadmin'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const requesterRole = req.user!.role;
  const isRequesterSuperAdmin = requesterRole === 'superadmin';
  const isRequesterAdmin = requesterRole === 'admin';

  if (!isRequesterSuperAdmin && !isRequesterAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: (req.params.id as string) } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Admin constraints
    if (isRequesterAdmin) {
      // Admin cannot change role to/from admin or superadmin
      if (role === 'admin' || role === 'superadmin') {
        return res.status(403).json({ error: 'Admins cannot assign admin or superadmin roles' });
      }
      if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
        return res.status(403).json({ error: 'Admins cannot modify roles of other admins or superadmins' });
      }
    }

    // Assign new badges based on role
    let badges = targetUser.badges;
    // Remove old role badges
    badges = badges.filter(b => b !== 'Super Admin' && b !== 'Admin' && b !== 'Moderator');
    if (role === 'superadmin') {
      badges.unshift('Super Admin');
    } else if (role === 'admin') {
      badges.unshift('Admin');
    } else if (role === 'moderator') {
      badges.unshift('Moderator');
    }

    const updatedUser = await prisma.user.update({
      where: { id: (req.params.id as string) },
      data: { role, badges }
    });

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Purge user identity (admin/superadmin only)
usersRouter.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  const requesterId = req.user!.id;
  const requesterRole = req.user!.role;
  const isRequesterSuperAdmin = requesterRole === 'superadmin';
  const isRequesterAdmin = requesterRole === 'admin';

  if (!isRequesterSuperAdmin && !isRequesterAdmin) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (requesterId === (req.params.id as string)) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }

  try {
    const targetUser = await prisma.user.findUnique({ where: { id: (req.params.id as string) } });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Admin constraints
    if (isRequesterAdmin) {
      // Admin cannot delete admin or superadmin
      if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
        return res.status(403).json({ error: 'Admins cannot delete other admins or superadmins' });
      }
    }

    await prisma.user.delete({
      where: { id: (req.params.id as string) }
    });

    broadcastStatsUpdate();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to purge user identity' });
  }
});
