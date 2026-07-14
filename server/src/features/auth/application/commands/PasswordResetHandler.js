import crypto from "crypto";
import { Hash } from "../../../../shared/utils/Hash.js";
import { BadRequestError } from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

// --- Commands ---

export class RequestPasswordResetCommand {
  constructor(email) {
    this.email = email;
  }
}

export class ResetPasswordCommand {
  constructor(token, password) {
    this.token = token;
    this.password = password;
  }
}

// --- Domain Events ---

export class PasswordResetRequestedEvent {
  eventName = "auth.password.reset_requested";
  occurredAt = new Date();
  constructor(userId, email, resetToken) {
    this.userId = userId;
    this.email = email;
    this.resetToken = resetToken;
  }
}

export class PasswordResetCompletedEvent {
  eventName = "auth.password.reset_completed";
  occurredAt = new Date();
  constructor(userId) {
    this.userId = userId;
  }
}

// --- Handlers ---

export class RequestPasswordResetHandler {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  async execute(command) {
    const user = await this.userRepo.findByEmail(
      command.email.trim().toLowerCase(),
    );

    // Do NOT throw error if user is not found to prevent user enumeration
    if (!user) {
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour validity

    await this.userRepo.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetTokenExpires: resetTokenExpires,
    });

    await EventBus.publish(
      new PasswordResetRequestedEvent(user.id, user.email, resetToken),
    );

    return { success: true };
  }
}

export class ResetPasswordHandler {
  constructor(userRepo, sessionRepo) {
    this.userRepo = userRepo;
    this.sessionRepo = sessionRepo;
  }

  async execute(command) {
    const user = await this.userRepo.findByResetToken(command.token);

    if (!user) {
      throw new BadRequestError("Invalid or expired password reset token");
    }

    // 1. Argon2id Hash of new password
    const hashedPassword = await Hash.hash(command.password);

    // 2. Persist new credentials
    await this.userRepo.update(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
      failedLoginAttempts: 0,
      lockoutUntil: null,
    });

    // 3. Force sign-out from all active sessions (security policy)
    await this.sessionRepo.revokeAllForUser(user.id);

    // 4. Publish Event
    await EventBus.publish(new PasswordResetCompletedEvent(user.id));

    return { success: true };
  }
}
