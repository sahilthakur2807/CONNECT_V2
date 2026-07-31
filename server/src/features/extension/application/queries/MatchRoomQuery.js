import { prisma } from "../../../../infrastructure/db/PrismaClient.js";

// --- Query ---

export class MatchRoomQuery {
  /**
   * @param {string} userId - The authenticated user ID
   * @param {Object} params
   * @param {string} [params.selectedText] - Text selected by user (text-mode)
   * @param {string} [params.url] - Webpage URL (url-mode)
   * @param {string} [params.title] - Extracted article title for fuzzy matching
   */
  constructor(userId, params) {
    this.userId = userId;
    this.selectedText = params.selectedText || null;
    this.url = params.url || null;
    this.title = params.title || null;
  }
}

// --- Handler ---

export class MatchRoomHandler {
  async execute(query) {
    const matches = [];
    const seenIds = new Set();

    // URL-mode: check for existing article records and room sourceUrl matches
    if (query.url) {
      const normalizedUrl = this._normalizeUrl(query.url);

      // 1. Check Article table for matching URL → linked rooms
      const article = await prisma.article.findFirst({
        where: {
          OR: [
            { url: query.url },
            { normalized_url: normalizedUrl },
          ],
        },
        include: {
          rooms: {
            where: { deleted: false },
            include: {
              createdBy: {
                select: { id: true, username: true, name: true, avatar: true },
              },
              _count: {
                select: {
                  members: true,
                  messages: { where: { deleted: false } },
                },
              },
            },
          },
        },
      });

      if (article) {
        for (const room of article.rooms) {
          if (!seenIds.has(room.id)) {
            seenIds.add(room.id);
            matches.push({ ...room, matchSource: "article" });
          }
        }
      }

      // 2. Check rooms with matching sourceUrl
      const sourceUrlRooms = await prisma.room.findMany({
        where: {
          deleted: false,
          sourceUrl: query.url,
        },
        include: {
          createdBy: {
            select: { id: true, username: true, name: true, avatar: true },
          },
          _count: {
            select: {
              members: true,
              messages: { where: { deleted: false } },
            },
          },
        },
      });

      for (const room of sourceUrlRooms) {
        if (!seenIds.has(room.id)) {
          seenIds.add(room.id);
          matches.push({ ...room, matchSource: "sourceUrl" });
        }
      }

      // 3. Fuzzy title search from extracted article title
      if (query.title) {
        const titleRooms = await this._searchByTitle(query.title, seenIds);
        matches.push(...titleRooms);
        titleRooms.forEach((r) => seenIds.add(r.id));
      }
    }

    // Text-mode: search rooms by selected text
    if (query.selectedText) {
      const textRooms = await this._searchByText(query.selectedText, seenIds, query.userId);
      matches.push(...textRooms);
    }

    // Sort: exact URL matches first, then by member count
    matches.sort((a, b) => {
      const sourceOrder = { article: 0, sourceUrl: 1, title: 2, text: 3 };
      const orderDiff = (sourceOrder[a.matchSource] || 3) - (sourceOrder[b.matchSource] || 3);
      if (orderDiff !== 0) return orderDiff;
      return (b._count?.members || 0) - (a._count?.members || 0);
    });

    return {
      rooms: matches.slice(0, 10),
      totalMatches: matches.length,
      hasExactMatch: matches.some((m) => m.matchSource === "article" || m.matchSource === "sourceUrl"),
    };
  }

  /**
   * Searches rooms by title similarity using Prisma contains.
   */
  async _searchByTitle(title, excludeIds) {
    // Split title into meaningful keywords (skip short words)
    const keywords = title
      .split(/[\s\-–—:,|]+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const rooms = await prisma.room.findMany({
      where: {
        deleted: false,
        id: { notIn: Array.from(excludeIds) },
        OR: [
          { title: { contains: title, mode: "insensitive" } },
          ...keywords.map((keyword) => ({
            title: { contains: keyword, mode: "insensitive" },
          })),
        ],
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: {
            members: true,
            messages: { where: { deleted: false } },
          },
        },
      },
      take: 10,
      orderBy: { members: { _count: "desc" } },
    });

    return rooms.map((room) => ({ ...room, matchSource: "title" }));
  }

  /**
   * Searches rooms by selected text content.
   */
  async _searchByText(text, excludeIds, userId) {
    const searchQuery = text.trim().substring(0, 200);
    if (searchQuery.length < 3) return [];

    const rooms = await prisma.room.findMany({
      where: {
        deleted: false,
        id: { notIn: Array.from(excludeIds) },
        OR: [
          { title: { contains: searchQuery, mode: "insensitive" } },
          { description: { contains: searchQuery, mode: "insensitive" } },
        ],
        AND: [
          {
            OR: [
              { communityId: null },
              userId
                ? {
                    community: {
                      members: {
                        some: { userId, banned: false },
                      },
                    },
                  }
                : { communityId: null },
            ],
          },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: {
          select: {
            members: true,
            messages: { where: { deleted: false } },
          },
        },
      },
      take: 10,
      orderBy: { members: { _count: "desc" } },
    });

    return rooms.map((room) => ({ ...room, matchSource: "text" }));
  }

  /**
   * Normalizes a URL for deduplication (strip protocol, trailing slash, www, query params).
   */
  _normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, "");
      const pathname = parsed.pathname.replace(/\/$/, "");
      return `${hostname}${pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }
}
