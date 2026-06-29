import { prisma } from '@infrastructure/db/PrismaClient.js';
import { broadcastStatsUpdate } from '@infrastructure/socket/SocketServer.js';
import { BadRequestError, NotFoundError } from '@shared/errors/AppError.js';

// --- Helper URL Normalization ---

export const normalizeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') + parsed.pathname.replace(/\/$/, '');
  } catch (e) {
    return url;
  }
};

// --- Commands & Queries ---

export class LookupRoomQuery {
  constructor(public readonly url: string) {}
}

export class CreateExtensionRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly url: string,
    public readonly title: string,
    public readonly description?: string,
    public readonly source?: string
  ) {}
}

export class JoinExtensionRoomCommand {
  constructor(
    public readonly userId: string,
    public readonly roomId: string
  ) {}
}

// --- Handlers ---

export class LookupRoomHandler {
  async execute(query: LookupRoomQuery) {
    const normalized_url = normalizeUrl(query.url);

    const article = await prisma.article.findUnique({
      where: { normalized_url },
      include: {
        rooms: {
          include: {
            _count: {
              select: { members: true, messages: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (article && article.rooms.length > 0) {
      return { room: article.rooms[0] };
    }

    return { room: null };
  }
}

export class CreateExtensionRoomHandler {
  async execute(command: CreateExtensionRoomCommand) {
    const normalized_url = normalizeUrl(command.url);

    let article = await prisma.article.findUnique({ where: { normalized_url } });
    if (!article) {
      article = await prisma.article.create({
        data: {
          url: command.url,
          normalized_url,
          title: command.title,
          source: command.source || null
        }
      });
    }

    const titleParts = command.title.split(/::|\||—/).map((s: string) => s.trim()).filter(Boolean);
    const mainTitle = titleParts[0] || command.title;
    const extractedTags = titleParts.slice(1).map((tag: string) => tag.replace(/^#/, ''));

    const room = await prisma.room.create({
      data: {
        title: mainTitle,
        description: command.description || `Discussion room for: ${mainTitle}`,
        category: 'Article',
        tags: extractedTags,
        sourceUrl: command.url,
        articleId: article.id,
        createdById: command.userId
      }
    });

    broadcastStatsUpdate();

    // Create activity record
    await prisma.activity.create({
      data: {
        userId: command.userId,
        roomId: room.id,
        actionType: 'ROOM_CREATED'
      }
    });
    
    // Add user as member
    await prisma.roomMember.create({
      data: {
        userId: command.userId,
        roomId: room.id
      }
    });

    return prisma.room.findUnique({
      where: { id: room.id },
      include: {
        _count: {
          select: { members: true, messages: true }
        }
      }
    });
  }
}

export class JoinExtensionRoomHandler {
  async execute(command: JoinExtensionRoomCommand): Promise<void> {
    const existingMember = await prisma.roomMember.findUnique({
      where: { userId_roomId: { userId: command.userId, roomId: command.roomId } }
    });

    if (!existingMember) {
      await prisma.roomMember.create({
        data: {
          userId: command.userId,
          roomId: command.roomId
        }
      });
      
      await prisma.activity.create({
        data: {
          userId: command.userId,
          roomId: command.roomId,
          actionType: 'ROOM_JOINED'
        }
      });
    }
  }
}
