import { prisma } from '@infrastructure/db/PrismaClient.js';
import { NotFoundError } from '@shared/errors/AppError.js';

// --- Queries ---

export class GetCommunitiesQuery {}

export class GetCommunityByIdQuery {
  constructor(public readonly id: string) {}
}

export class GetCommunityMembersQuery {
  constructor(public readonly communityId: string) {}
}

// --- Handlers ---

export class GetCommunitiesHandler {
  async execute(query: GetCommunitiesQuery) {
    return prisma.community.findMany({
      include: { _count: { select: { members: true, rooms: true } } }
    });
  }
}

export class GetCommunityByIdHandler {
  async execute(query: GetCommunityByIdQuery) {
    const community = await prisma.community.findUnique({
      where: { id: query.id },
      include: { _count: { select: { members: true, rooms: true } } }
    });

    if (!community) {
      throw new NotFoundError('Community not found');
    }

    return community;
  }
}

export class GetCommunityMembersHandler {
  async execute(query: GetCommunityMembersQuery) {
    const members = await prisma.communityMember.findMany({
      where: { communityId: query.communityId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            role: true,
            status: true,
            verified: true,
            reputation: true,
            badges: true
          }
        }
      }
    });

    return members.map(m => m.user);
  }
}
