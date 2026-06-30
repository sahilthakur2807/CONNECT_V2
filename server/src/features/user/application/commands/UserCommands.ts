import { prisma } from '@infrastructure/db/PrismaClient.js';
import { handleFriendAdded, broadcastStatsUpdate, pushRealtimeNotification, io, userSockets } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@shared/errors/AppError.js';

// --- Commands ---

export class AddFriendCommand {
  constructor(
    public readonly userId: string,
    public readonly friendId: string
  ) {}
}

export class AcceptFriendCommand {
  constructor(
    public readonly userId: string,
    public readonly requesterId: string
  ) {}
}

export class RejectFriendCommand {
  constructor(
    public readonly userId: string,
    public readonly requesterId: string
  ) {}
}

export class RemoveFriendCommand {
  constructor(
    public readonly userId: string,
    public readonly friendId: string
  ) {}
}

export class UpdateUserRoleCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly role: string,
    public readonly requesterUserId: string,
    public readonly requesterRole: string
  ) {}
}

export class DeleteUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly requesterUserId: string,
    public readonly requesterRole: string
  ) {}
}

// --- Handlers ---

export class AddFriendHandler {
  async execute(command: AddFriendCommand): Promise<void> {
    if (command.userId === command.friendId) {
      throw new BadRequestError('Cannot add yourself as a friend');
    }

    const friend = await prisma.user.findUnique({ where: { id: command.friendId } });
    if (!friend) {
      throw new NotFoundError('User not found');
    }
    if (friend.role === 'admin') {
      throw new BadRequestError('Cannot add site admin as a friend');
    }

    const currentUser = await prisma.user.findUnique({ where: { id: command.userId } });
    if (!currentUser) {
      throw new NotFoundError('Current user not found');
    }

    // Check if there is an existing friendship in either direction
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: command.userId, friendId: command.friendId },
          { userId: command.friendId, friendId: command.userId }
        ]
      }
    });

    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestError('Already friends');
      }
      
      // If the request was sent by the other user, adding them back accepts it
      if (existing.friendId === command.userId) {
        await prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted' }
        });
        
        await handleFriendAdded(command.userId, command.friendId);

        // Notify other user
        const notification = await prisma.notification.create({
          data: {
            userId: command.friendId,
            triggerId: command.userId,
            type: 'friend_accept',
            title: 'Friend Request Accepted',
            body: `${currentUser.username} accepted your friend request.`,
            referenceId: command.userId
          },
          include: { trigger: true }
        });
        pushRealtimeNotification(command.friendId, notification);
        return;
      }

      throw new BadRequestError('Friend request already sent');
    }

    // Create pending request
    await prisma.friendship.create({
      data: {
        userId: command.userId,
        friendId: command.friendId,
        status: 'pending'
      }
    });

    // Create Notification
    const notification = await prisma.notification.create({
      data: {
        userId: command.friendId,
        triggerId: command.userId,
        type: 'friend_request',
        title: 'Friend Request Received',
        body: `${currentUser.username} sent you a friend request.`,
        referenceId: command.userId
      },
      include: { trigger: true }
    });
    pushRealtimeNotification(command.friendId, notification);
  }
}

export class AcceptFriendHandler {
  async execute(command: AcceptFriendCommand): Promise<void> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: command.requesterId,
        friendId: command.userId,
        status: 'pending'
      }
    });

    if (!friendship) {
      throw new NotFoundError('Friend request not found');
    }

    await prisma.friendship.update({
      where: { id: friendship.id },
      data: { status: 'accepted' }
    });

    await handleFriendAdded(command.userId, command.requesterId);

    const currentUser = await prisma.user.findUnique({ where: { id: command.userId } });
    if (currentUser) {
      const notification = await prisma.notification.create({
        data: {
          userId: command.requesterId,
          triggerId: command.userId,
          type: 'friend_accept',
          title: 'Friend Request Accepted',
          body: `${currentUser.username} accepted your friend request.`,
          referenceId: command.userId
        },
        include: { trigger: true }
      });
      pushRealtimeNotification(command.requesterId, notification);
    }
  }
}

export class RejectFriendHandler {
  async execute(command: RejectFriendCommand): Promise<void> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId: command.requesterId,
        friendId: command.userId,
        status: 'pending'
      }
    });

    if (!friendship) {
      return;
    }

    await prisma.friendship.delete({
      where: { id: friendship.id }
    });
  }
}

export class RemoveFriendHandler {
  async execute(command: RemoveFriendCommand): Promise<void> {
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: command.userId, friendId: command.friendId },
          { userId: command.friendId, friendId: command.userId }
        ]
      }
    });

    if (!friendship) {
      throw new NotFoundError('Friendship not found');
    }

    await prisma.friendship.delete({
      where: { id: friendship.id }
    });

    // Notify sockets to sync offline status
    const socketsA = userSockets.get(command.userId);
    if (socketsA && io) {
      for (const socketId of socketsA) {
        io.to(socketId).emit('friend_offline', { userId: command.friendId });
      }
    }
    const socketsB = userSockets.get(command.friendId);
    if (socketsB && io) {
      for (const socketId of socketsB) {
        io.to(socketId).emit('friend_offline', { userId: command.userId });
      }
    }
  }
}

export class UpdateUserRoleHandler {
  async execute(command: UpdateUserRoleCommand) {
    const validRoles = ['user', 'moderator', 'admin', 'superadmin'];
    if (!validRoles.includes(command.role)) {
      throw new BadRequestError('Invalid role');
    }

    const isRequesterSuperAdmin = command.requesterRole === 'superadmin';
    const isRequesterAdmin = command.requesterRole === 'admin';

    if (!isRequesterSuperAdmin && !isRequesterAdmin) {
      throw new UnauthorizedError('Access denied');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: command.targetUserId } });
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (isRequesterAdmin) {
      if (command.role === 'admin' || command.role === 'superadmin') {
        throw new UnauthorizedError('Admins cannot assign admin or superadmin roles');
      }
      if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
        throw new UnauthorizedError('Admins cannot modify roles of other admins or superadmins');
      }
    }

    let badges = targetUser.badges;
    // Remove old role badges
    badges = badges.filter(b => b !== 'Super Admin' && b !== 'Admin' && b !== 'Moderator');
    if (command.role === 'superadmin') {
      badges.unshift('Super Admin');
    } else if (command.role === 'admin') {
      badges.unshift('Admin');
    } else if (command.role === 'moderator') {
      badges.unshift('Moderator');
    }

    return prisma.user.update({
      where: { id: command.targetUserId },
      data: { role: command.role, badges }
    });
  }
}

export class DeleteUserHandler {
  async execute(command: DeleteUserCommand): Promise<void> {
    if (command.requesterUserId === command.targetUserId) {
      throw new BadRequestError('You cannot delete your own account');
    }

    const isRequesterSuperAdmin = command.requesterRole === 'superadmin';
    const isRequesterAdmin = command.requesterRole === 'admin';

    if (!isRequesterSuperAdmin && !isRequesterAdmin) {
      throw new UnauthorizedError('Access denied');
    }

    const targetUser = await prisma.user.findUnique({ where: { id: command.targetUserId } });
    if (!targetUser) {
      throw new NotFoundError('User not found');
    }

    if (isRequesterAdmin) {
      if (targetUser.role === 'admin' || targetUser.role === 'superadmin') {
        throw new UnauthorizedError('Admins cannot delete other admins or superadmins');
      }
    }

    await prisma.user.delete({ where: { id: command.targetUserId } });
    broadcastStatsUpdate();
  }
}
