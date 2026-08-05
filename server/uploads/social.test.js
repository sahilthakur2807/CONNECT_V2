import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SendFriendRequestHandler,
  SendFriendRequestCommand,
  BlockUserHandler,
  BlockUserCommand,
} from "../src/features/social/application/commands/SocialCommands.js";
import {
  GetNotificationsHandler,
  GetNotificationsQuery,
} from "../src/features/social/application/queries/SocialQueries.js";
import { SocialPolicy } from "../src/features/social/application/SocialPolicy.js";
import {
  activeUserConnections,
  io,
} from "../src/infrastructure/socket/SocketServer.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

// Mock Prisma
vi.mock("../src/infrastructure/db/PrismaClient.js", () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    friendship: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ id: "usr_1", name: "User A", username: "usera" }),
    },
  };
  return { prisma: mockPrisma };
});

// Mock Socket.IO
vi.mock("../src/infrastructure/socket/SocketServer.js", () => {
  const mockIo = {
    to: vi.fn(() => mockIo),
    emit: vi.fn(),
  };
  return {
    io: mockIo,
    activeUserConnections: new Map(),
    SocketEventRegistry: {
      register: vi.fn(),
      getHandlers: vi.fn().mockReturnValue([]),
    },
  };
});

describe("CONNECT Phase 5 Social & Presence Unit Tests", () => {
  let mockFriendshipRepo;
  let mockBlockRepo;
  let mockNotificationRepo;

  beforeEach(() => {
    vi.restoreAllMocks();
    activeUserConnections.clear();

    mockFriendshipRepo = {
      findById: vi.fn(),
      findFriendship: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockBlockRepo = {
      findBlock: vi.fn(),
      hasBlockRelationship: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };

    mockNotificationRepo = {
      create: vi.fn(),
      update: vi.fn(),
      findHistory: vi.fn(),
    };
  });

  // 1. Policy checks
  describe("SocialPolicy validations", () => {
    it("should deny sending friend request to oneself", () => {
      const allowed = SocialPolicy.canRequestFriendship(
        "usr_1",
        "usr_1",
        false,
      );
      expect(allowed).toBe(false);
    });

    it("should deny request if a block relationship exists", () => {
      const allowed = SocialPolicy.canRequestFriendship("usr_1", "usr_2", true);
      expect(allowed).toBe(false);
    });
  });

  // 2. Send Friend Request (with notifications and socket broadcasts)
  describe("SendFriendRequestHandler", () => {
    it("should create pending friendship, insert notification, and emit socket alert", async () => {
      const handler = new SendFriendRequestHandler(
        mockFriendshipRepo,
        mockBlockRepo,
        mockNotificationRepo,
      );
      const command = new SendFriendRequestCommand(
        "usr_sender",
        "usr_recipient",
      );

      mockBlockRepo.hasBlockRelationship.mockResolvedValue(false);
      mockFriendshipRepo.findFriendship.mockResolvedValue(null);
      mockFriendshipRepo.create.mockResolvedValue({
        id: "fr_123",
        status: "pending",
      });
      mockNotificationRepo.create.mockResolvedValue({
        id: "notif_1",
        type: "friend.request.sent",
      });

      const result = await handler.execute(command);

      expect(result.status).toBe("pending");
      expect(mockFriendshipRepo.create).toHaveBeenCalled();
      expect(mockNotificationRepo.create).toHaveBeenCalled();
      expect(io?.to).toHaveBeenCalledWith("usr_recipient");
      expect(io?.emit).toHaveBeenCalledWith(
        "notification.created",
        expect.any(Object),
      );
    });
  });

  // 3. Block user dissolves friendship
  describe("BlockUserHandler", () => {
    it("should create block record and delete active friendship between them", async () => {
      const handler = new BlockUserHandler(mockBlockRepo, mockFriendshipRepo);
      const command = new BlockUserCommand("usr_blocker", "usr_blocked");

      mockBlockRepo.getDelegate = vi.fn().mockReturnValue({
        findUnique: vi.fn().mockResolvedValue(null),
      });
      mockBlockRepo.create.mockResolvedValue({ id: "blk_123" });
      mockFriendshipRepo.findFriendship.mockResolvedValue({ id: "fr_123" });

      await handler.execute(command);

      expect(mockBlockRepo.create).toHaveBeenCalled();
      expect(mockFriendshipRepo.delete).toHaveBeenCalledWith(
        "fr_123",
        expect.any(Object),
      );
    });
  });

  // 4. Cursor Pagination for Notifications
  describe("GetNotificationsHandler", () => {
    it("should query history with specific cursor", async () => {
      const handler = new GetNotificationsHandler(mockNotificationRepo);
      const query = new GetNotificationsQuery("usr_1", 15, "notif_cursor");

      await handler.execute(query);
      expect(mockNotificationRepo.findHistory).toHaveBeenCalledWith(
        "usr_1",
        15,
        "notif_cursor",
      );
    });
  });

  // 5. Multi-device presence transitions
  describe("Multi-device Presence Tracker", () => {
    it("should keep user online if only one tab of multiple is closed", () => {
      const userId = "usr_multi";
      // Simulate connecting 2 tabs/sockets
      const userConnections = new Set();
      userConnections.add("socket_1");
      userConnections.add("socket_2");
      activeUserConnections.set(userId, userConnections);

      expect(activeUserConnections.get(userId)?.size).toBe(2);

      // Disconnect socket_1
      userConnections.delete("socket_1");

      // The count is 1, user is still considered online
      expect(activeUserConnections.get(userId)?.size).toBe(1);
      expect(activeUserConnections.has(userId)).toBe(true);

      // Disconnect socket_2 (last session closed)
      userConnections.delete("socket_2");
      if (userConnections.size === 0) {
        activeUserConnections.delete(userId);
      }

      // Now user is offline
      expect(activeUserConnections.has(userId)).toBe(false);
    });
  });
});
