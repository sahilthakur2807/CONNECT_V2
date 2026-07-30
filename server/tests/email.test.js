import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EmailService } from "../src/infrastructure/email/EmailService.js";
import { EventBus } from "../src/shared/event-bus/EventBus.js";
import { registerEmailSubscribers } from "../src/features/auth/infrastructure/events/EmailNotificationSubscribers.js";
import { UserRepository } from "../src/features/user/infrastructure/repository/UserRepository.js";

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
});
