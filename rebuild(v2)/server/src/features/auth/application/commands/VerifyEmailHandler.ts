import { UserRepository } from '../../../user/infrastructure/repository/UserRepository.js';
import { BadRequestError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

export class VerifyEmailCommand {
  constructor(public readonly token: string) {}
}

export class EmailVerifiedEvent implements IDomainEvent {
  readonly eventName = 'auth.email.verified';
  readonly occurredAt = new Date();
  constructor(public readonly userId: string) {}
}

export class VerifyEmailHandler {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(command: VerifyEmailCommand): Promise<{ success: boolean }> {
    const user = await this.userRepo.findByVerificationToken(command.token);

    if (!user) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Mark as verified
    await this.userRepo.update(user.id, {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      verified: true
    });

    await EventBus.publish(new EmailVerifiedEvent(user.id));

    return { success: true };
  }
}
