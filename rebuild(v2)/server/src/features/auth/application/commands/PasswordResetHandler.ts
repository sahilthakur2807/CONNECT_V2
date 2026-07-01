import crypto from 'crypto';
import { UserRepository } from '../../../user/infrastructure/repository/UserRepository.js';
import { SessionRepository } from '../../infrastructure/repository/SessionRepository.js';
import { Hash } from '../../../../shared/utils/Hash.js';
import { BadRequestError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

// --- Commands ---

export class RequestPasswordResetCommand {
  constructor(public readonly email: string) {}
}

export class ResetPasswordCommand {
  constructor(
    public readonly token: string,
    public readonly password: string
  ) {}
}

// --- Domain Events ---

export class PasswordResetRequestedEvent implements IDomainEvent {
  readonly eventName = 'auth.password.reset_requested';
  readonly occurredAt = new Date();
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly resetToken: string
  ) {}
}

export class PasswordResetCompletedEvent implements IDomainEvent {
  readonly eventName = 'auth.password.reset_completed';
  readonly occurredAt = new Date();
  constructor(public readonly userId: string) {}
}

// --- Handlers ---

export class RequestPasswordResetHandler {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(command: RequestPasswordResetCommand): Promise<{ success: boolean }> {
    const user = await this.userRepo.findByEmail(command.email.trim().toLowerCase());

    // Do NOT throw error if user is not found to prevent user enumeration
    if (!user) {
      return { success: true };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour validity

    await this.userRepo.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetTokenExpires: resetTokenExpires
    });

    await EventBus.publish(new PasswordResetRequestedEvent(
      user.id,
      user.email,
      resetToken
    ));

    return { success: true };
  }
}

export class ResetPasswordHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly sessionRepo: SessionRepository
  ) {}

  async execute(command: ResetPasswordCommand): Promise<{ success: boolean }> {
    const user = await this.userRepo.findByResetToken(command.token);

    if (!user) {
      throw new BadRequestError('Invalid or expired password reset token');
    }

    // 1. Argon2id Hash of new password
    const hashedPassword = await Hash.hash(command.password);

    // 2. Persist new credentials
    await this.userRepo.update(user.id, {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetTokenExpires: null,
      failedLoginAttempts: 0,
      lockoutUntil: null
    });

    // 3. Force sign-out from all active sessions (security policy)
    await this.sessionRepo.revokeAllForUser(user.id);

    // 4. Publish Event
    await EventBus.publish(new PasswordResetCompletedEvent(user.id));

    return { success: true };
  }
}
