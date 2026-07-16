import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateCommunityHandler,
  CreateCommunityCommand,
  DeleteCommunityHandler,
  DeleteCommunityCommand,
  TransferOwnershipHandler,
  TransferOwnershipCommand,
} from "../src/features/community/application/commands/CommunityCommands.js";
import {
  CreateRoomHandler,
  CreateRoomCommand,
} from "../src/features/room/application/commands/RoomCommands.js";
import { CommunityPolicy } from "../src/features/community/application/CommunityPolicy.js";
import { RoomPolicy } from "../src/features/room/application/RoomPolicy.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";
import { ForbiddenError } from "../src/shared/errors/AppError.js";

// Mock Prisma transaction and client models
vi.mock("../src/infrastructure/db/PrismaClient.js", () => {
  const mockPrisma = {
    $transaction: vi.fn((cb) => cb(mockPrisma)),
    room: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    hashtag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    roomMember: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  return { prisma: mockPrisma };
});

describe("CONNECT Phase 3 Domain Unit Tests", () => {
  let mockCommunityRepo;
  let mockMembershipRepo;
  let mockRoomRepo;

  beforeEach(() => {
    vi.restoreAllMocks();

    prisma.room = {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn(),
    };
    prisma.hashtag = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    prisma.roomMember = {
      create: vi.fn().mockResolvedValue({}),
    };

    mockCommunityRepo = {
      findById: vi.fn(),
      findByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockMembershipRepo = {
      findMember: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockRoomRepo = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
  });

  // 1. Centralized Policy Checks
  describe("Policy Matrices", () => {
    it("should allow community owner to update community details", () => {
      const allowed = CommunityPolicy.canUpdate(
        { id: "usr_owner", role: "user" },
        "usr_owner",
        { role: "owner", banned: false, muted: false },
      );
      expect(allowed).toBe(true);
    });

    it("should deny regular members from archiving communities", () => {
      const allowed = CommunityPolicy.canArchive(
        { id: "usr_member", role: "user" },
        "usr_owner",
      );
      expect(allowed).toBe(false);
    });

    it("should allow moderators to ban community members", () => {
      const allowed = CommunityPolicy.canBanOrMute(
        { id: "usr_mod", role: "user" },
        { role: "moderator", banned: false, muted: false },
      );
      expect(allowed).toBe(true);
    });

    it("should deny muted/banned community members from creating rooms", () => {
      const allowed = RoomPolicy.canCreateRoom(
        { id: "usr_muted", role: "user" },
        "comm_1",
        { role: "member", banned: true, muted: true },
      );
      expect(allowed).toBe(false);
    });
  });

  // 2. Create Community Command
  describe("CreateCommunityHandler", () => {
    it("should create community and atomically attach owner membership", async () => {
      const handler = new CreateCommunityHandler(
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new CreateCommunityCommand(
        "usr_1",
        "Philosophy Group",
        "Discuss ideas",
        "Humanities",
      );

      mockCommunityRepo.findByName.mockResolvedValue(null);
      mockCommunityRepo.create.mockResolvedValue({
        id: "comm_1",
        name: "Philosophy Group",
      });

      const result = await handler.execute(command);
      expect(mockCommunityRepo.create).toHaveBeenCalled();
      expect(mockMembershipRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "OWNER",
          user: { connect: { id: "usr_1" } },
        }),
        expect.any(Object),
      );
      expect(result.id).toBe("comm_1");
    });
  });

  // 3. Ownership Transfer Use-case
  describe("TransferOwnershipHandler", () => {
    it("should promote target user to owner and demote old owner atomically", async () => {
      const handler = new TransferOwnershipHandler(
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new TransferOwnershipCommand(
        "usr_owner",
        "comm_1",
        "usr_target",
      );

      mockCommunityRepo.findById.mockResolvedValue({
        id: "comm_1",
        createdById: "usr_owner",
      });
      mockMembershipRepo.findMember.mockImplementation(async (userId) => {
        if (userId === "usr_target")
          return { id: "memb_target", role: "member", banned: false };
        if (userId === "usr_owner")
          return { id: "memb_owner", role: "owner", banned: false };
        return null;
      });

      await handler.execute(command);

      expect(mockCommunityRepo.update).toHaveBeenCalledWith(
        "comm_1",
        {
          createdBy: { connect: { id: "usr_target" } },
        },
        expect.any(Object),
      );
      expect(mockMembershipRepo.update).toHaveBeenCalledWith(
        "memb_target",
        { role: "OWNER" },
        expect.any(Object),
      );
      expect(mockMembershipRepo.update).toHaveBeenCalledWith(
        "memb_owner",
        { role: "ADMIN" },
        expect.any(Object),
      );
    });
  });

  // 4. Soft Delete Cascade Use-case
  describe("DeleteCommunityHandler", () => {
    it("should soft-delete community and trigger cascade room deletions", async () => {
      const handler = new DeleteCommunityHandler(mockCommunityRepo);
      const command = new DeleteCommunityCommand("usr_owner", "comm_1", "user");

      mockCommunityRepo.findById.mockResolvedValue({
        id: "comm_1",
        createdById: "usr_owner",
        deleted: false,
      });
      await handler.execute(command);

      expect(mockCommunityRepo.update).toHaveBeenCalledWith(
        "comm_1",
        { deleted: true },
        expect.any(Object),
      );
      expect(prisma.room.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { communityId: "comm_1", deleted: false },
          data: { deleted: true },
        }),
      );
    });
  });

  // 5. Room Creation Use-case
  describe("CreateRoomHandler", () => {
    it("should create room under community if creator is a valid member", async () => {
      const handler = new CreateRoomHandler(
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new CreateRoomCommand(
        "usr_member",
        "Socrates Room",
        "Discuss dialogues",
        "culture",
        ["philosophy"],
        "comm_1",
      );

      mockCommunityRepo.findById.mockResolvedValue({
        id: "comm_1",
        createdById: "usr_owner",
        deleted: false,
        archived: false,
      });
      mockMembershipRepo.findMember.mockResolvedValue({
        role: "member",
        banned: false,
        muted: false,
      });
      mockRoomRepo.create.mockResolvedValue({
        id: "room_1",
        title: "Socrates Room",
      });

      const result = await handler.execute(command);
      expect(result.id).toBe("room_1");
      expect(mockRoomRepo.create).toHaveBeenCalled();
    });

    it("should fail room creation if creator is banned from the community", async () => {
      const handler = new CreateRoomHandler(
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new CreateRoomCommand(
        "usr_banned",
        "Socrates Room",
        "Discuss dialogues",
        "culture",
        ["philosophy"],
        "comm_1",
      );

      mockCommunityRepo.findById.mockResolvedValue({
        id: "comm_1",
        createdById: "usr_owner",
        deleted: false,
        archived: false,
      });
      mockMembershipRepo.findMember.mockResolvedValue({
        role: "member",
        banned: true,
        muted: false,
      });

      await expect(handler.execute(command)).rejects.toThrow(ForbiddenError);
    });
  });
});
