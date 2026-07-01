import crypto from 'crypto';
import { type AuthTokens, type AuthService } from '../AuthService.js';
import { UserRepository } from '../../../user/infrastructure/repository/UserRepository.js';
import { Hash } from '../../../../shared/utils/Hash.js';
import { BadRequestError } from '../../../../shared/errors/AppError.js';
import { EventBus, type IDomainEvent } from '../../../../shared/event-bus/EventBus.js';

const RESERVED_USERNAMES = new Set([
  'admin', 'superadmin', 'moderator', 'settings', 'api', 'logout', 'login', 'register',
  'help', 'support', 'root', 'auth', 'null', 'undefined', 'newsconnect', 'connect',
  'system', 'administrator'
]);

export class RegisterCommand {
  constructor(
    public readonly username: string,
    public readonly email: string,
    public readonly password: string,
    public readonly name?: string,
    public readonly bio?: string,
    public readonly deviceInfo?: string,
    public readonly ipAddress?: string
  ) {}
}

export class UserRegisteredEvent implements IDomainEvent {
  readonly eventName = 'auth.user.registered';
  readonly occurredAt = new Date();
  constructor(
    public readonly userId: string,
    public readonly username: string,
    public readonly email: string,
    public readonly verificationToken: string
  ) {}
}

export class RegisterHandler {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly authService: AuthService
  ) {}

  async execute(command: RegisterCommand): Promise<{ tokens: AuthTokens; user: any }> {
    const sanitizedUsername = command.username.trim().toLowerCase();
    const sanitizedEmail = command.email.trim().toLowerCase();

    // 1. Reserved username check
    if (RESERVED_USERNAMES.has(sanitizedUsername)) {
      throw new BadRequestError(`Username "${command.username}" is reserved and cannot be registered`);
    }

    // 2. Existence check
    const existingUser = await this.userRepo.findByEmailOrUsername(sanitizedUsername);
    if (existingUser) {
      throw new BadRequestError('Username or email is already registered');
    }
    const existingEmail = await this.userRepo.findByEmailOrUsername(sanitizedEmail);
    if (existingEmail) {
      throw new BadRequestError('Username or email is already registered');
    }

    // 3. Argon2id Hash
    const hashedPassword = await Hash.hash(command.password);

    // 4. Generate verification token (expires in 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date();
    verificationTokenExpires.setHours(verificationTokenExpires.getHours() + 24);

    // 5. Create user
    const user = await this.userRepo.create({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
      name: command.name || command.username,
      bio: command.bio || '',
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sanitizedUsername)}`,
      role: 'user',
      status: 'online',
      verified: false,
      emailVerified: false,
      verificationToken,
      verificationTokenExpires,
      reputation: 10, // Default reputation points
      badges: ['Early Member']
    });

    // 6. Create session & tokens
    const tokens = await this.authService.createSession(
      user.id,
      command.deviceInfo,
      command.ipAddress
    );

    // 7. Publish registration domain event
    await EventBus.publish(new UserRegisteredEvent(
      user.id,
      user.username,
      user.email,
      verificationToken
    ));

    const { password: _, verificationToken: __, ...sanitizedUser } = user;
    return { tokens, user: sanitizedUser };
  }
}
