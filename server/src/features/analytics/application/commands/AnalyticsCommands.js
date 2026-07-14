import { reputationLogRepository } from "../../infrastructure/repository/ReputationLogRepository.js";
import { ForbiddenError } from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

// --- Commands ---

export class AwardReputationCommand {
  constructor(actorId, actorRole, targetUserId, amount, reason) {
    this.actorId = actorId;
    this.actorRole = actorRole;
    this.targetUserId = targetUserId;
    this.amount = amount;
    this.reason = reason;
  }
}

// --- Domain Events ---

export class ReputationAwardedEvent {
  eventName = "reputation.awarded";
  occurredAt = new Date();
  constructor(userId, amount, reason, actorId) {
    this.userId = userId;
    this.amount = amount;
    this.reason = reason;
    this.actorId = actorId;
  }
}

// --- Handlers ---

export class AwardReputationHandler {
  async execute(command) {
    const isAuthorized = ["admin", "superadmin", "moderator"].includes(
      command.actorRole,
    );
    if (!isAuthorized) {
      throw new ForbiddenError(
        "You do not have permission to manually adjust reputation points",
      );
    }

    const log = await reputationLogRepository.logAward(
      command.targetUserId,
      command.amount,
      `manual: ${command.reason}`,
    );

    await EventBus.publish(
      new ReputationAwardedEvent(
        command.targetUserId,
        command.amount,
        command.reason,
        command.actorId,
      ),
    );

    return log;
  }
}
