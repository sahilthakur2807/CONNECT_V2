import { EventBus } from "../../../../shared/event-bus/EventBus.js";
import { Logger } from "../../../../shared/logger/Logger.js";
import { activityLogRepository } from "../repository/ActivityLogRepository.js";
import { UserRepository } from "../../../user/infrastructure/repository/UserRepository.js";

// Events

const userRepo = new UserRepository();

export function registerAuthAuditSubscribers() {
  // 1. User Registered
  EventBus.subscribe("auth.user.registered", async (event) => {
    Logger.info(
      `User registered successfully: "${event.username}" (ID: ${event.userId})`,
    );
    await activityLogRepository.logAction(
      event.userId,
      "auth.register",
      `Registered account with email: ${event.email}. Verification token generated.`,
    );
  });

  // 2. Login Success
  EventBus.subscribe("auth.login.success", async (event) => {
    Logger.info(`User login success (ID: ${event.userId})`);
    await activityLogRepository.logAction(
      event.userId,
      "auth.login",
      `Successful login from IP: ${event.ipAddress || "unknown"}`,
    );
  });

  // 3. Login Failed
  EventBus.subscribe("auth.login.failed", async (event) => {
    Logger.warn(
      `User login failed for identifier "${event.identifier}": ${event.reason}`,
    );
    // Resolve user if they exist to link failed logs
    const user = await userRepo.findByEmailOrUsername(event.identifier);
    if (user) {
      await activityLogRepository.logAction(
        user.id,
        "auth.login_failed",
        `Failed attempt: ${event.reason} from IP: ${event.ipAddress || "unknown"}`,
      );
    }
  });

  // 4. OAuth Success
  EventBus.subscribe("auth.oauth.success", async (event) => {
    Logger.info(
      `OAuth login success (ID: ${event.userId}) via provider: ${event.provider}`,
    );
    await activityLogRepository.logAction(
      event.userId,
      "auth.oauth_login",
      `Successful login via provider "${event.provider}" from IP: ${event.ipAddress || "unknown"}`,
    );
  });

  // 5. Email Verified
  EventBus.subscribe("auth.email.verified", async (event) => {
    Logger.info(`User email verified (ID: ${event.userId})`);
    await activityLogRepository.logAction(
      event.userId,
      "auth.email_verify",
      "Email address verified successfully.",
    );
  });

  // 6. Password Reset Requested
  EventBus.subscribe("auth.password.reset_requested", async (event) => {
    Logger.info(`Password reset requested for User ID ${event.userId}`);
    await activityLogRepository.logAction(
      event.userId,
      "auth.password_reset_request",
      `Password reset token requested for email ${event.email}`,
    );
  });

  // 7. Password Reset Completed
  EventBus.subscribe("auth.password.reset_completed", async (event) => {
    Logger.info(
      `Password reset successfully completed for User ID ${event.userId}`,
    );
    await activityLogRepository.logAction(
      event.userId,
      "auth.password_reset_complete",
      "Password successfully reset. All other active sessions revoked.",
    );
  });

  // 8. Session Revoked
  EventBus.subscribe("auth.session.revoked", async (event) => {
    Logger.info(`Session revoked (ID: ${event.userId}), scope: ${event.scope}`);
    await activityLogRepository.logAction(
      event.userId,
      "auth.logout",
      `Session revoked with scope: ${event.scope}`,
    );
  });
}
