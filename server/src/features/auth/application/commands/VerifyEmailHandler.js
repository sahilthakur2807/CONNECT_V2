import { BadRequestError } from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

export class VerifyEmailCommand {
  constructor(token) {
    this.token = token;
  }
}

export class EmailVerifiedEvent {
  eventName = "auth.email.verified";
  occurredAt = new Date();
  constructor(userId) {
    this.userId = userId;
  }
}

export class VerifyEmailHandler {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  async execute(command) {
    const user = await this.userRepo.findByVerificationToken(command.token);

    if (!user) {
      throw new BadRequestError("Invalid or expired verification token");
    }

    // Mark as verified
    await this.userRepo.update(user.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      verified: true,
    });

    await EventBus.publish(new EmailVerifiedEvent(user.id));

    return { success: true };
  }
}
