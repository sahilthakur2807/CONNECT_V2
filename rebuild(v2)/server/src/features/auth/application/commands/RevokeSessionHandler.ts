import { SessionRepository } from '../../infrastructure/repository/SessionRepository.js';
import { UserRepository } from '../../../user/infrastructure/repository/UserRepository.js';
import { BadRequestError, UnauthorizedError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

export type RevocationScope = 'current' | 'all' | 'other';

export class RevokeSessionCommand {
  constructor(
    public readonly userId: string,
    public readonly scope: RevocationScope,
    public readonly currentToken?: string
  ) {}
}

export class SessionRevokedEvent implements IDomainEvent {
  readonly eventName = 'auth.session.revoked';
  readonly occurredAt = new Date();
  constructor(
    public readonly userId: string,
    public readonly scope: RevocationScope
  ) {}
}

export class RevokeSessionHandler {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly userRepo: UserRepository
  ) {}

  async execute(command: RevokeSessionCommand): Promise<{ success: boolean }> {
    if (command.scope === 'current') {
      if (!command.currentToken) {
        throw new BadRequestError('Current token is required to revoke the active session');
      }
      const session = await this.sessionRepo.findByToken(command.currentToken);
      if (!session) {
        throw new UnauthorizedError('Session not found');
      }
      if (session.userId !== command.userId) {
        throw new UnauthorizedError('Access denied: Session ownership mismatch');
      }

      await this.sessionRepo.revokeSession(session.id);
      
      // Update status to offline if no other active sessions remain
      const activeSessions = await this.sessionRepo.findActiveByUserId(command.userId);
      if (activeSessions.length <= 1) { // includes the current one just revoked in DB (not loaded dynamically yet or just checking)
        await this.userRepo.update(command.userId, { status: 'offline' });
      }

    } else if (command.scope === 'all') {
      await this.sessionRepo.revokeAllForUser(command.userId);
      await this.userRepo.update(command.userId, { status: 'offline' });

    } else if (command.scope === 'other') {
      if (!command.currentToken) {
        throw new BadRequestError('Current token is required to exclude from revocation');
      }
      await this.sessionRepo.revokeOthersForUser(command.userId, command.currentToken);
    } else {
      throw new BadRequestError('Unsupported revocation scope');
    }

    await EventBus.publish(new SessionRevokedEvent(command.userId, command.scope));

    return { success: true };
  }
}
