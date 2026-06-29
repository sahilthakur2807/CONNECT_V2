import { prisma } from '@infrastructure/db/PrismaClient.js';
import { broadcastStatsUpdate } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, NotFoundError } from '@shared/errors/AppError.js';

// --- Commands ---

export class CreateCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly description: string,
    public readonly category: string = 'General',
    public readonly imageUrl?: string
  ) {}
}

export class JoinCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {}
}

export class LeaveCommunityCommand {
  constructor(
    public readonly userId: string,
    public readonly communityId: string
  ) {}
}

// --- Handlers ---

export class CreateCommunityHandler {
  async execute(command: CreateCommunityCommand) {
    const existing = await prisma.community.findUnique({
      where: { name: command.name }
    });

    if (existing) {
      throw new BadRequestError('Community with this name already exists');
    }

    const community = await prisma.community.create({
      data: {
        name: command.name,
        description: command.description,
        category: command.category,
        createdById: command.userId,
        imageUrl: command.imageUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${command.name}`
      }
    });

    // Creator auto-joins as admin
    await prisma.communityMember.create({
      data: {
        userId: command.userId,
        communityId: community.id,
        role: 'admin'
      }
    });

    broadcastStatsUpdate();

    return community;
  }
}

export class JoinCommunityHandler {
  async execute(command: JoinCommunityCommand): Promise<void> {
    const existing = await prisma.communityMember.findUnique({
      where: {
        userId_communityId: {
          userId: command.userId,
          communityId: command.communityId
        }
      }
    });

    if (existing) {
      throw new BadRequestError('Already a member of this community');
    }

    await prisma.communityMember.create({
      data: {
        userId: command.userId,
        communityId: command.communityId
      }
    });
  }
}

export class LeaveCommunityHandler {
  async execute(command: LeaveCommunityCommand): Promise<void> {
    try {
      await prisma.communityMember.delete({
        where: {
          userId_communityId: {
            userId: command.userId,
            communityId: command.communityId
          }
        }
      });
    } catch {
      throw new NotFoundError('Community membership not found');
    }
  }
}
