import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../src/infrastructure/email/EmailService.js";
import { EventBus } from "../src/shared/event-bus/EventBus.js";
import { registerEmailSubscribers } from "../src/features/auth/infrastructure/events/EmailNotificationSubscribers.js";
import { registerNotificationSubscribers } from "../src/features/social/infrastructure/events/NotificationEventSubscribers.js";
import { UserRepository } from "../src/features/user/infrastructure/repository/UserRepository.js";
import { prisma } from "../src/infrastructure/db/PrismaClient.js";

vi.mock("../src/infrastructure/db/PrismaClient.js", () => ({
  prisma: {
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

describe("Email Notification System (Gmail OAuth2)", () => {
  beforeEach(() => {
    // Reset transporter state for tests
    EmailService.transport = null;
  });

  it("should successfully send verification email using console fallback when OAuth is not configured", async () => {
    const result = await EmailService.sendVerificationEmail(
      "test@example.com",
      "testuser",
      "dummy-verification-token"
    );

    expect(result).toBeDefined();
    expect(result.messageId).toBe("mock-gmail-id-success");
  });

  it("should successfully send password reset email using console fallback when OAuth is not configured", async () => {
    const result = await EmailService.sendPasswordResetEmail(
      "test@example.com",
      "testuser",
      "dummy-reset-token"
    );

    expect(result).toBeDefined();
    expect(result.messageId).toBe("mock-gmail-id-success");
  });

  it("should successfully send welcome email using console fallback when OAuth is not configured", async () => {
    const result = await EmailService.sendWelcomeEmail(
      "test@example.com",
      "testuser"
    );

    expect(result).toBeDefined();
    expect(result.messageId).toBe("mock-gmail-id-success");
  });

  it("should successfully send reply notification email using console fallback when OAuth is not configured", async () => {
    const result = await EmailService.sendReplyNotificationEmail(
      "test@example.com",
      "parentuser",
      "Hello world",
      "replyuser",
      "This is a reply",
      "room-123",
      "Tech Talk Room",
      // ancestorChain: [root, ..., parentMessage]
      [
        { id: "msg_root", parentId: null, content: "Head message", user: { username: "originator", name: "Originator" } },
        { id: "msg_parent", parentId: "msg_root", content: "Hello world", user: { username: "parentuser", name: "parentuser" } }
      ],
      [{ id: "msg_prior", content: "Earlier reply", user: { username: "other" } }]
    );

    expect(result).toBeDefined();
    expect(result.messageId).toBe("mock-gmail-id-success");
  });

  it("should trigger sendVerificationEmail and sendWelcomeEmail when auth.user.registered event is published", async () => {
    registerEmailSubscribers();

    const verifySpy = vi.spyOn(EmailService, "sendVerificationEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });
    const welcomeSpy = vi.spyOn(EmailService, "sendWelcomeEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });

    const event = {
      eventName: "auth.user.registered",
      userId: "usr_999",
      username: "eventspy",
      email: "spy@example.com",
      verificationToken: "spy-token-xyz",
      occurredAt: new Date()
    };

    await EventBus.publish(event);

    expect(verifySpy).toHaveBeenCalledWith(
      "spy@example.com",
      "eventspy",
      "spy-token-xyz"
    );

    expect(welcomeSpy).toHaveBeenCalledWith(
      "spy@example.com",
      "eventspy"
    );

    verifySpy.mockRestore();
    welcomeSpy.mockRestore();
  });

  it("should trigger sendPasswordResetEmail when auth.password.reset_requested event is published", async () => {
    registerEmailSubscribers();

    const spy = vi.spyOn(EmailService, "sendPasswordResetEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });
    
    // Mock user lookup on UserRepository prototype
    const dbSpy = vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue({
      id: "usr_999",
      username: "eventspy",
      email: "spy@example.com"
    });

    const event = {
      eventName: "auth.password.reset_requested",
      userId: "usr_999",
      email: "spy@example.com",
      resetToken: "reset-token-abc",
      occurredAt: new Date()
    };

    await EventBus.publish(event);

    expect(spy).toHaveBeenCalledWith(
      "spy@example.com",
      "eventspy",
      "reset-token-abc"
    );

    spy.mockRestore();
    dbSpy.mockRestore();
  });

  it("should trigger sendWelcomeEmail when auth.email.verified event is published", async () => {
    registerEmailSubscribers();

    const spy = vi.spyOn(EmailService, "sendWelcomeEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });
    
    // Mock user lookup on UserRepository prototype
    const dbSpy = vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue({
      id: "usr_999",
      username: "eventspy",
      email: "spy@example.com"
    });

    const event = {
      eventName: "auth.email.verified",
      userId: "usr_999",
      occurredAt: new Date()
    };

    await EventBus.publish(event);

    expect(spy).toHaveBeenCalledWith(
      "spy@example.com",
      "eventspy"
    );

    spy.mockRestore();
    dbSpy.mockRestore();
  });

  it("should successfully send login notification email using console fallback when OAuth is not configured", async () => {
    const result = await EmailService.sendLoginNotificationEmail(
      "test@example.com",
      "testuser",
      "127.0.0.1"
    );

    expect(result).toBeDefined();
    expect(result.messageId).toBe("mock-gmail-id-success");
  });

  it("should trigger sendLoginNotificationEmail when auth.login.success event is published", async () => {
    registerEmailSubscribers();

    const spy = vi.spyOn(EmailService, "sendLoginNotificationEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });
    
    // Mock user lookup on UserRepository prototype
    const dbSpy = vi.spyOn(UserRepository.prototype, "findById").mockResolvedValue({
      id: "usr_999",
      username: "eventspy",
      email: "spy@example.com"
    });

    const event = {
      eventName: "auth.login.success",
      userId: "usr_999",
      ipAddress: "192.168.1.1",
      occurredAt: new Date()
    };

    await EventBus.publish(event);

    expect(spy).toHaveBeenCalledWith(
      "spy@example.com",
      "eventspy",
      "192.168.1.1"
    );

    spy.mockRestore();
    dbSpy.mockRestore();
  });

  it("should trigger sendReplyNotificationEmail when message.created event is published and is a reply to another user", async () => {
    registerNotificationSubscribers();

    const spy = vi.spyOn(EmailService, "sendReplyNotificationEmail").mockResolvedValue({ messageId: "mock-gmail-id-success" });

    vi.mocked(prisma.message.findUnique)
      // 1st call: fetch the reply message (includes room)
      .mockResolvedValueOnce({
        id: "msg_reply",
        parentId: "msg_parent",
        userId: "usr_replier",
        content: "I reply to your comment",
        roomId: "room_abc",
        user: {
          id: "usr_replier",
          name: "Replier User",
          username: "replier"
        },
        room: { id: "room_abc", title: "Tech Discussion" }
      })
      // 2nd call: fetch parent message
      .mockResolvedValueOnce({
        id: "msg_parent",
        parentId: null,
        userId: "usr_parent",
        content: "Original message",
        user: {
          id: "usr_parent",
          name: "Parent User",
          username: "parent",
          email: "parent@example.com"
        }
      });

    // 3rd call: walk up to root — parent already has parentId: null so cursor stops here (no extra findUnique)
    vi.mocked(prisma.message.findMany).mockResolvedValue([]);

    vi.mocked(prisma.notification.create).mockResolvedValue({
      id: "notif_reply",
    });

    const event = {
      eventName: "message.created",
      messageId: "msg_reply",
      roomId: "room_abc",
      occurredAt: new Date()
    };

    await EventBus.publish(event);

    expect(spy).toHaveBeenCalledWith(
      "parent@example.com",
      "parent",
      "Original message",
      "replier",
      "I reply to your comment",
      "room_abc",
      "Tech Discussion",
      // ancestorChain: parentMessage has parentId: null → chain is just [parentMessage]
      expect.arrayContaining([expect.objectContaining({ id: "msg_parent" })]),
      []
    );

    spy.mockRestore();
  });

  it("should resolve client base network host URL correctly without using localhost", () => {
    const baseUrl = EmailService._getClientBaseUrl();
    expect(baseUrl).not.toContain("trycloudflare.com");
    expect(baseUrl).not.toContain("localhost");
    expect(baseUrl).not.toContain("127.0.0.1");
    expect(baseUrl).toMatch(/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/);
    expect(baseUrl.endsWith("/")).toBe(false);
  });
});
