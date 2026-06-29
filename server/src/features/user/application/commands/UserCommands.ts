import { prisma } from '@infrastructure/db/PrismaClient.js';
import { handleFriendAdded, broadcastStatsUpdate } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '@shared/errors/AppError.js';

// --- Commands ---

export class AddFriendCommand {
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

    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { userId: command.userId, friendId: command.friendId },
          { userId: command.friendId, friendId: command.userId }
        ]
      }
    });

    if (existing) {
      throw new BadRequestError('Already friends');
    }

    await prisma.friendship.create({
      data: {
        userId: command.userId,
        friendId: command.friendId
      }
    });

    await handleFriendAdded(command.userId, command.friendId);
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
