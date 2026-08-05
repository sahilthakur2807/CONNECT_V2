import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { EmailService } from "../../../../infrastructure/email/EmailService.js";
import { UserRepository } from "../../../user/infrastructure/repository/UserRepository.js";

const userRepo = new UserRepository();

export function registerEmailSubscribers() {
  // 1. Send Verification Email and Welcome Email on User Registration
  EventBus.subscribe("auth.user.registered", async (event) => {
    Logger.info(
      `EmailNotificationSubscribers: Processing user registration event for "${event.username}"`,
    );
    try {
      await EmailService.sendVerificationEmail(
        event.email,
        event.username,
        event.verificationToken,
      );
    } catch (err) {
      Logger.error(
        `EmailNotificationSubscribers: Failed to process registration email dispatch for ${event.email}:`,
        err,
      );
    }

    try {
      await EmailService.sendWelcomeEmail(
        event.email,
        event.username,
      );
    } catch (err) {
      Logger.error(
        `EmailNotificationSubscribers: Failed to process welcome email dispatch on registration for ${event.email}:`,
        err,
      );
    }
  });

  // 2. Send Password Reset Email on Request
  EventBus.subscribe("auth.password.reset_requested", async (event) => {
    Logger.info(
      `EmailNotificationSubscribers: Processing password reset request for User ID: ${event.userId}`,
    );
    try {
      const user = await userRepo.findById(event.userId);
      const username = user?.username || "citizen";

      await EmailService.sendPasswordResetEmail(
        event.email,
        username,
        event.resetToken,
      );
    } catch (err) {
      Logger.error(
        `EmailNotificationSubscribers: Failed to process password reset email dispatch for User ID ${event.userId}:`,
        err,
      );
    }
  });

  // 3. Send Welcome Email on Email Verification Success
  EventBus.subscribe("auth.email.verified", async (event) => {
    Logger.info(
      `EmailNotificationSubscribers: Processing email verification success for User ID: ${event.userId}`,
    );
    try {
      const user = await userRepo.findById(event.userId);
      if (!user) {
        Logger.warn(
          `EmailNotificationSubscribers: User ID ${event.userId} not found for welcome email.`,
        );
        return;
      }

      await EmailService.sendWelcomeEmail(user.email, user.username);
    } catch (err) {
      Logger.error(
        `EmailNotificationSubscribers: Failed to process welcome email dispatch for User ID ${event.userId}:`,
        err,
      );
    }
  });

  // 4. Send Login Notification Email on Successful Login
  EventBus.subscribe("auth.login.success", async (event) => {
    Logger.info(
      `EmailNotificationSubscribers: Processing successful login for User ID: ${event.userId}`,
    );
    try {
      const user = await userRepo.findById(event.userId);
      if (!user) {
        Logger.warn(
          `EmailNotificationSubscribers: User ID ${event.userId} not found for login notification email.`,
        );
        return;
      }

      await EmailService.sendLoginNotificationEmail(
        user.email,
        user.username,
        event.ipAddress || "Unknown IP",
      );
    } catch (err) {
      Logger.error(
        `EmailNotificationSubscribers: Failed to process login notification email for User ID ${event.userId}:`,
        err,
      );
    }
  });
}
