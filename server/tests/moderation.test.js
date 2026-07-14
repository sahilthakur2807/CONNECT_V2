import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateReportHandler,
  CreateReportCommand,
  ExecuteModerationActionHandler,
  ExecuteModerationActionCommand,
  ResolveAppealHandler,
  ResolveAppealCommand,
  RemoveContentCommand,
  RemoveContentHandler,
  RestoreContentCommand,
  RestoreContentHandler,
} from "../src/features/moderation/application/commands/ModerationCommands.js";
import { AuditLogRepository } from "../src/features/moderation/infrastructure/repository/AuditLogRepository.js";
import { ModerationPolicy } from "../src/features/moderation/application/ModerationPolicy.js";
import { io } from "../src/infrastructure/socket/SocketServer.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";
import { ForbiddenError } from "../src/shared/errors/AppError.js";

// Mock Prisma
vi.mock("../src/infrastructure/db/PrismaClient.js", () => ({
  prisma: {
    $transaction: vi.fn((cb) => cb(prisma)),
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

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

describe("CONNECT Phase 6 Moderation & Governance Unit Tests", () => {
  let mockReportRepo;
  let mockActionRepo;
  let mockAppealRepo;
  let mockAuditRepo;
  let mockMembershipRepo;
  let mockMessageRepo;
  let mockRoomRepo;
  let mockCommunityRepo;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockReportRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      findOpenReports: vi.fn(),
      findAssignedReports: vi.fn(),
    };

    mockActionRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockAppealRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      findOpenAppeals: vi.fn(),
    };

    mockAuditRepo = {
      create: vi.fn(),
      findAuditRecords: vi.fn(),
    };

    mockMembershipRepo = {
      findMember: vi.fn(),
    };

    mockMessageRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockRoomRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockCommunityRepo = {
      findById: vi.fn(),
      update: vi.fn(),
    };
  });

  // 1. Policy boundaries
  describe("ModerationPolicy Authorizations", () => {
    it("should deny platform bans to regular users", () => {
      const allowed = ModerationPolicy.canExecutePlatformAction({
        id: "usr_member",
        role: "user",
      });
      expect(allowed).toBe(false);
    });

    it("should allow platform bans to platform admins", () => {
      const allowed = ModerationPolicy.canExecutePlatformAction({
        id: "usr_admin",
        role: "admin",
      });
      expect(allowed).toBe(true);
    });

    it("should allow community moderation to community moderators", () => {
      const membership = {
        id: "mem_1",
        role: "moderator",
        banned: false,
        muted: false,
      };
      const allowed = ModerationPolicy.canExecuteCommunityAction(
        { id: "usr_mod", role: "user" },
        membership,
      );
      expect(allowed).toBe(true);
    });
  });

  // 2. Report creations & Socket signals
  describe("CreateReportHandler", () => {
    it("should create pending report and emit alert to moderators channel", async () => {
      const handler = new CreateReportHandler(mockReportRepo);
      const command = new CreateReportCommand(
        "usr_reporter",
        "spam",
        "Spamming channels",
        "usr_target",
      );

      mockReportRepo.create.mockResolvedValue({
        id: "rep_123",
        status: "pending",
      });

      const result = await handler.execute(command);

      expect(result.status).toBe("pending");
      expect(mockReportRepo.create).toHaveBeenCalled();
      expect(io?.to).toHaveBeenCalledWith("moderators");
      expect(io?.emit).toHaveBeenCalledWith(
        "report.created",
        expect.any(Object),
      );
    });
  });

  // 3. Enforcement executors
  describe("ExecuteModerationActionHandler", () => {
    it("should create enforcement action, update user status to offline, and log to audit repo", async () => {
      const handler = new ExecuteModerationActionHandler(
        mockActionRepo,
        mockAuditRepo,
        mockMembershipRepo,
      );
      const command = new ExecuteModerationActionCommand(
        "usr_admin",
        "admin",
        "usr_target",
        "ban",
        "Terms violations",
      );

      mockActionRepo.create.mockResolvedValue({ id: "act_123", type: "ban" });

      const result = await handler.execute(command);

      expect(result.type).toBe("ban");
      expect(mockActionRepo.create).toHaveBeenCalled();
      expect(mockAuditRepo.create).toHaveBeenCalled();
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "usr_target" },
          data: { status: "offline" },
        }),
      );
    });

    it("should check community memberships when executing community-scoped mute/bans", async () => {
      const handler = new ExecuteModerationActionHandler(
        mockActionRepo,
        mockAuditRepo,
        mockMembershipRepo,
      );
      const command = new ExecuteModerationActionCommand(
        "usr_actor",
        "user",
        "usr_target",
        "mute",
        "Spam",
        undefined,
        "comm_123",
      );

      mockMembershipRepo.findMember.mockResolvedValue({
        id: "mem_1",
        role: "moderator",
        banned: false,
        muted: false,
      });
      mockActionRepo.create.mockResolvedValue({ id: "act_123", type: "mute" });

      const result = await handler.execute(command);

      expect(result.type).toBe("mute");
      expect(mockMembershipRepo.findMember).toHaveBeenCalledWith(
        "usr_actor",
        "comm_123",
      );
      expect(mockActionRepo.create).toHaveBeenCalled();
    });
  });

  // 4. Appeal approval lifts enforcement
  describe("ResolveAppealHandler", () => {
    it("should resolve appeal status and deactivate associated moderation action if approved", async () => {
      const handler = new ResolveAppealHandler(
        mockAppealRepo,
        mockActionRepo,
        mockAuditRepo,
      );
      const command = new ResolveAppealCommand(
        "usr_admin",
        "admin",
        "app_123",
        "approved",
        "Apologies accepted",
      );

      mockAppealRepo.findById.mockResolvedValue({
        id: "app_123",
        actionId: "act_123",
        status: "pending",
      });
      mockAppealRepo.update.mockResolvedValue({
        id: "app_123",
        status: "approved",
      });

      const result = await handler.execute(command);

      expect(result.status).toBe("approved");
      expect(mockActionRepo.update).toHaveBeenCalledWith(
        "act_123",
        { active: false },
        expect.any(Object),
      );
      expect(mockAuditRepo.create).toHaveBeenCalled();
    });
  });

  // 5. Immutable Audit Logs
  describe("AuditLogRepository Immutability", () => {
    it("should throw ForbiddenError on update calls", async () => {
      const repo = new AuditLogRepository();
      await expect(
        repo.update("log_123", { action: "hacked" }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw ForbiddenError on delete calls", async () => {
      const repo = new AuditLogRepository();
      await expect(repo.delete("log_123")).rejects.toThrow(ForbiddenError);
    });
  });

  // 6. Content Moderation Actions
  describe("Content Moderation Handler", () => {
    it("should allow admins to remove messages administratively and write audit logs", async () => {
      const handler = new RemoveContentHandler(
        mockMessageRepo,
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
        mockAuditRepo,
      );

      const command = new RemoveContentCommand(
        "usr_admin",
        "admin",
        "message",
        "msg_123",
        "Inappropriate content",
      );

      mockMessageRepo.findById.mockResolvedValue({
        id: "msg_123",
        roomId: "rm_123",
        deleted: false,
      });
      mockRoomRepo.findById.mockResolvedValue({
        id: "rm_123",
        communityId: null,
      }); // Global room

      await handler.execute(command);

      expect(mockMessageRepo.update).toHaveBeenCalledWith(
        "msg_123",
        { deleted: true },
        expect.any(Object),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "content.removed",
          targetId: "msg_123",
          targetType: "message",
        }),
        expect.any(Object),
      );
    });

    it("should allow admins to restore messages administratively and write audit logs", async () => {
      const handler = new RestoreContentHandler(
        mockMessageRepo,
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
        mockAuditRepo,
      );

      const command = new RestoreContentCommand(
        "usr_admin",
        "admin",
        "message",
        "msg_123",
        "Accidental deletion",
      );

      mockMessageRepo.findById.mockResolvedValue({
        id: "msg_123",
        roomId: "rm_123",
        deleted: true,
      });
      mockRoomRepo.findById.mockResolvedValue({
        id: "rm_123",
        communityId: null,
      });

      await handler.execute(command);

      expect(mockMessageRepo.update).toHaveBeenCalledWith(
        "msg_123",
        { deleted: false },
        expect.any(Object),
      );
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "content.restored",
          targetId: "msg_123",
          targetType: "message",
        }),
        expect.any(Object),
      );
    });
  });
});
