import {
  BadRequestError,
  UnauthorizedError,
} from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

export class RevokeSessionCommand {
  constructor(userId, scope, currentToken) {
    this.userId = userId;
    this.scope = scope;
    this.currentToken = currentToken;
  }
}

export class SessionRevokedEvent {
  eventName = "auth.session.revoked";
  occurredAt = new Date();
  constructor(userId, scope) {
    this.userId = userId;
    this.scope = scope;
  }
}

export class RevokeSessionHandler {
  constructor(sessionRepo, userRepo) {
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
  }

  async execute(command) {
    if (command.scope === "current") {
      if (!command.currentToken) {
        throw new BadRequestError(
          "Current token is required to revoke the active session",
        );
      }
      const session = await this.sessionRepo.findByToken(command.currentToken);
      if (!session) {
        throw new UnauthorizedError("Session not found");
      }
      if (session.userId !== command.userId) {
        throw new UnauthorizedError(
          "Access denied: Session ownership mismatch",
        );
      }

      await this.sessionRepo.revokeSession(session.id);
      // Update status to offline if no other active sessions remain
      const activeSessions = await this.sessionRepo.findActiveByUserId(
        command.userId,
      );
      if (activeSessions.length <= 1) {
        // includes the current one just revoked in DB (not loaded dynamically yet or just checking)
        await this.userRepo.update(command.userId, { status: "offline" });
      }
    } else if (command.scope === "all") {
      await this.sessionRepo.revokeAllForUser(command.userId);
      await this.userRepo.update(command.userId, { status: "offline" });
    } else if (command.scope === "other") {
      if (!command.currentToken) {
        throw new BadRequestError(
          "Current token is required to exclude from revocation",
        );
      }
      await this.sessionRepo.revokeOthersForUser(
        command.userId,
        command.currentToken,
      );
    } else {
      throw new BadRequestError("Unsupported revocation scope");
    }

    await EventBus.publish(
      new SessionRevokedEvent(command.userId, command.scope),
    );

    return { success: true };
  }
}
