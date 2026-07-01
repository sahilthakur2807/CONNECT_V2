import { type AuthTokens, type AuthService } from '../AuthService.js';
import { UserRepository } from '../../../user/infrastructure/repository/UserRepository.js';
import { Hash } from '../../../../shared/utils/Hash.js';
import { UnauthorizedError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

export class LoginCommand {
  constructor(
    public readonly identifier: string, // email or username
    public readonly password: string,
    public readonly deviceInfo?: string,
    public readonly ipAddress?: string
  ) {}
}

export class LoginSuccessEvent implements IDomainEvent {
  readonly eventName = 'auth.login.success';
  readonly occurredAt = new Date();
  constructor(
    public readonly userId: string,
    public readonly ipAddress?: string
  ) {}
}

export class LoginFailedEvent implements IDomainEvent {
  readonly eventName = 'auth.login.failed';
  readonly occurredAt = new Date();
  constructor(
    public readonly identifier: string,
    public readonly reason: string,
    public readonly ipAddress?: string
  ) {}
}

export class LoginHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService
  ) {}

  async execute(command: LoginCommand): Promise<{ tokens: AuthTokens; user: any }> {
    const user = await this.userRepo.findByEmailOrUsername(command.identifier.trim());

    if (!user) {
      await EventBus.publish(new LoginFailedEvent(command.identifier, 'User not found', command.ipAddress));
      throw new UnauthorizedError('Invalid credentials');
    }

    // 1. Lockout check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil((user.lockoutUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedError(`Account is temporarily locked due to repeated login failures. Try again in ${waitMinutes} minutes.`);
    }

    // 2. Compare passwords
    const isMatch = await Hash.compare(command.password, user.password);

    if (!isMatch) {
      // Increment failed attempts
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const data: any = { failedLoginAttempts };

      // Apply lockout if threshold is reached (5 attempts)
      if (failedLoginAttempts >= 5) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + 15); // Lock out for 15 minutes
        data.lockoutUntil = lockoutUntil;
      }

      await this.userRepo.update(user.id, data);
      await EventBus.publish(new LoginFailedEvent(command.identifier, 'Incorrect password', command.ipAddress));

      throw new UnauthorizedError('Invalid credentials');
    }

    // 3. Clear failed attempts on successful login
    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      status: 'online'
    });

    // 4. Start session
    const tokens = await this.authService.createSession(
      user.id,
      command.deviceInfo,
      command.ipAddress
    );

    // 5. Trigger audit logs
    await EventBus.publish(new LoginSuccessEvent(user.id, command.ipAddress));

    const { password: _, verificationToken: __, ...sanitizedUser } = user;
    return { tokens, user: sanitizedUser };
  }
}
