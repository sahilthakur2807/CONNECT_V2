import { reputationLogRepository } from '../../infrastructure/repository/ReputationLogRepository.js';
import { ForbiddenError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

// --- Commands ---

export class AwardReputationCommand {
  constructor(
    public readonly actorId: string,
    public readonly actorRole: string,
    public readonly targetUserId: string,
    public readonly amount: number,
    public readonly reason: string
  ) {}
}

// --- Domain Events ---

export class ReputationAwardedEvent implements IDomainEvent {
  readonly eventName = 'reputation.awarded';
  readonly occurredAt = new Date();
  constructor(
    public readonly userId: string,
    public readonly amount: number,
    public readonly reason: string,
    public readonly actorId: string
  ) {}
}

// --- Handlers ---

export class AwardReputationHandler {
  async execute(command: AwardReputationCommand): Promise<any> {
    const isAuthorized = ['admin', 'superadmin', 'moderator'].includes(command.actorRole);
    if (!isAuthorized) {
      throw new ForbiddenError('You do not have permission to manually adjust reputation points');
    }

    const log = await reputationLogRepository.logAward(
      command.targetUserId,
      command.amount,
      `manual: ${command.reason}`
    );

    await EventBus.publish(new ReputationAwardedEvent(
      command.targetUserId,
      command.amount,
      command.reason,
      command.actorId
    ));

    return log;
  }
}
