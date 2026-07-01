import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SendMessageHandler,
  SendMessageCommand,
  EditMessageHandler,
  EditMessageCommand,
} from "../src/features/message/application/commands/MessageCommands.js";
import {
  GetRoomMessagesHandler,
  GetRoomMessagesQuery,
} from "../src/features/message/application/queries/MessageQueries.js";
import { MessagePolicy } from "../src/features/message/application/MessagePolicy.js";
import { RoomJoinHandler } from "../src/features/message/presentation/socket/RoomJoinHandler.js";
import { io } from "../src/infrastructure/socket/SocketServer.js";

// Mock Socket.IO instance
vi.mock("../src/infrastructure/socket/SocketServer.js", () => {
  const mockIo = {
    to: vi.fn(() => mockIo),
    emit: vi.fn(),
  };
  return {
    io: mockIo,
    SocketEventRegistry: {
      register: vi.fn(),
      getHandlers: vi.fn().mockReturnValue([]),
    },
  };
});

describe("CONNECT Phase 4 Messaging Unit Tests", () => {
  let mockMessageRepo;
  let mockRoomRepo;
  let mockCommunityRepo;
  let mockMembershipRepo;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockMessageRepo = {
      findById: vi.fn(),
      findByClientMessageId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findHistoryAfter: vi.fn(),
      findHistoryBefore: vi.fn(),
    };

    mockRoomRepo = {
      findById: vi.fn(),
    };

    mockCommunityRepo = {
      findById: vi.fn(),
    };

    mockMembershipRepo = {
      findMember: vi.fn(),
    };
  });

  // 1. Policy checks
  describe("MessagePolicy Checks", () => {
    it("should deny muted community members from sending messages", () => {
      const allowed = MessagePolicy.canSend(
        { id: "usr_muted", role: "user" },
        { role: "member", banned: false, muted: true },
      );
      expect(allowed).toBe(false);
    });

    it("should allow regular members to post if not muted", () => {
      const allowed = MessagePolicy.canSend(
        { id: "usr_ok", role: "user" },
        { role: "member", banned: false, muted: false },
      );
      expect(allowed).toBe(true);
    });

    it("should deny editing other users messages", () => {
      const allowed = MessagePolicy.canMutate(
        { id: "usr_other", role: "user" },
        "usr_author",
      );
      expect(allowed).toBe(false);
    });
  });

  // 2. Send Message with Idempotency and Broadcast checks
  describe("SendMessageHandler", () => {
    it("should send a message and trigger Socket.IO broadcast", async () => {
      const handler = new SendMessageHandler(
        mockMessageRepo,
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new SendMessageCommand(
        "usr_1",
        "room_123",
        "Hello world",
        "client-uuid-123",
      );

      mockRoomRepo.findById.mockResolvedValue({
        id: "room_123",
        communityId: null,
        deleted: false,
        archived: false,
      });
      mockMessageRepo.findByClientMessageId.mockResolvedValue(null);
      mockMessageRepo.create.mockResolvedValue({
        id: "msg_1",
        content: "Hello world",
      });
      mockMessageRepo.findById.mockResolvedValue({
        id: "msg_1",
        content: "Hello world",
        userId: "usr_1",
        roomId: "room_123",
      });

      const result = await handler.execute(command);

      expect(result.id).toBe("msg_1");
      expect(mockMessageRepo.create).toHaveBeenCalled();
      expect(io?.to).toHaveBeenCalledWith("room_123");
      expect(io?.emit).toHaveBeenCalledWith(
        "chat.message.created",
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: "msg_1" }),
        }),
      );
    });

    it("should enforce idempotency by returning existing message when clientMessageId matches", async () => {
      const handler = new SendMessageHandler(
        mockMessageRepo,
        mockRoomRepo,
        mockCommunityRepo,
        mockMembershipRepo,
      );
      const command = new SendMessageCommand(
        "usr_1",
        "room_123",
        "Hello world",
        "client-uuid-123",
      );

      mockRoomRepo.findById.mockResolvedValue({
        id: "room_123",
        communityId: null,
        deleted: false,
        archived: false,
      });
      // Simulate existing duplicate record
      mockMessageRepo.findByClientMessageId.mockResolvedValue({
        id: "msg_existing",
        content: "Hello world",
        clientMessageId: "client-uuid-123",
      });

      const result = await handler.execute(command);

      expect(result.id).toBe("msg_existing");
      expect(mockMessageRepo.create).not.toHaveBeenCalled();
    });
  });

  // 3. Edit and Delete Handlers
  describe("Edit & Delete Handlers", () => {
    it("should edit message and broadcast event", async () => {
      const handler = new EditMessageHandler(mockMessageRepo);
      const command = new EditMessageCommand(
        "usr_author",
        "msg_1",
        "Edited text",
      );

      mockMessageRepo.findById.mockResolvedValue({
        id: "msg_1",
        userId: "usr_author",
        roomId: "room_123",
        deleted: false,
      });
      mockMessageRepo.update.mockResolvedValue({
        id: "msg_1",
        content: "Edited text",
        edited: true,
      });

      const result = await handler.execute(command);
      expect(result.edited).toBe(true);
      expect(io?.emit).toHaveBeenCalledWith(
        "chat.message.updated",
        expect.any(Object),
      );
    });
  });

  // 4. History Queries with Cursor Pagination
  describe("GetRoomMessagesHandler cursor checks", () => {
    it("should trigger findHistoryBefore query when direction is before", async () => {
      const handler = new GetRoomMessagesHandler(mockMessageRepo);
      const query = new GetRoomMessagesQuery(
        "room_123",
        20,
        "cursor_id",
        "before",
      );

      await handler.execute(query);
      expect(mockMessageRepo.findHistoryBefore).toHaveBeenCalledWith(
        "room_123",
        20,
        "cursor_id",
      );
    });

    it("should trigger findHistoryAfter query when direction is after", async () => {
      const handler = new GetRoomMessagesHandler(mockMessageRepo);
      const query = new GetRoomMessagesQuery(
        "room_123",
        20,
        "cursor_id",
        "after",
      );

      await handler.execute(query);
      expect(mockMessageRepo.findHistoryAfter).toHaveBeenCalledWith(
        "room_123",
        20,
        "cursor_id",
      );
    });
  });

  // 5. Socket Room Join validation
  describe("RoomJoinHandler socket checking", () => {
    it("should deny joining room channel if user is not community member", async () => {
      const socket = {
        user: { id: "usr_non_member", username: "guest" },
        emit: vi.fn(),
        join: vi.fn(),
      };

      mockRoomRepo.findById.mockResolvedValue({
        id: "room_1",
        communityId: "comm_1",
      });
      mockMembershipRepo.findMember.mockResolvedValue(null); // non-member

      const joinHandler = new RoomJoinHandler(mockRoomRepo, mockMembershipRepo);
      await joinHandler.handle(socket, { roomId: "room_1" });

      expect(socket.join).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith(
        "chat.room.joined.response",
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: "FORBIDDEN" }),
        }),
      );
    });
  });
});
