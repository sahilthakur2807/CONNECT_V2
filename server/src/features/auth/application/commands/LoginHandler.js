import { Hash } from "../../../../shared/utils/Hash.js";
import { UnauthorizedError } from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

export class LoginCommand {
  constructor(
    identifier, // email or username
    password,
    deviceInfo,
    ipAddress,
  ) {
    this.identifier = identifier;
    this.password = password;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
  }
}

export class LoginSuccessEvent {
  eventName = "auth.login.success";
  occurredAt = new Date();
  constructor(userId, ipAddress) {
    this.userId = userId;
    this.ipAddress = ipAddress;
  }
}

export class LoginFailedEvent {
  eventName = "auth.login.failed";
  occurredAt = new Date();
  constructor(identifier, reason, ipAddress) {
    this.identifier = identifier;
    this.reason = reason;
    this.ipAddress = ipAddress;
  }
}

export class LoginHandler {
  constructor(userRepo, authService) {
    this.userRepo = userRepo;
    this.authService = authService;
  }

  async execute(command) {
    const user = await this.userRepo.findByEmailOrUsername(
      command.identifier.trim(),
    );

    if (!user) {
      await EventBus.publish(
        new LoginFailedEvent(
          command.identifier,
          "User not found",
          command.ipAddress,
        ),
      );
      throw new UnauthorizedError("Invalid credentials");
    }

    // 1. Lockout check
    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      const waitMinutes = Math.ceil(
        (user.lockoutUntil.getTime() - Date.now()) / 60000,
      );
      throw new UnauthorizedError(
        `Account is temporarily locked due to repeated login failures. Try again in ${waitMinutes} minutes.`,
      );
    }

    // 2. Compare passwords
    const isMatch = await Hash.compare(command.password, user.password);

    if (!isMatch) {
      // Increment failed attempts
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const data = { failedLoginAttempts };

      // Apply lockout if threshold is reached (5 attempts)
      if (failedLoginAttempts >= 5) {
        const lockoutUntil = new Date();
        lockoutUntil.setMinutes(lockoutUntil.getMinutes() + 15); // Lock out for 15 minutes
        data.lockoutUntil = lockoutUntil;
      }

      await this.userRepo.update(user.id, data);
      await EventBus.publish(
        new LoginFailedEvent(
          command.identifier,
          "Incorrect password",
          command.ipAddress,
        ),
      );

      throw new UnauthorizedError("Invalid credentials");
    }

    // 3. Clear failed attempts on successful login
    await this.userRepo.update(user.id, {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      status: "online",
    });

    // 4. Start session
    const tokens = await this.authService.createSession(
      user.id,
      command.deviceInfo,
      command.ipAddress,
    );

    // 5. Trigger audit logs
    await EventBus.publish(new LoginSuccessEvent(user.id, command.ipAddress));

    const { password: _, verificationToken: __, ...sanitizedUser } = user;
    return { tokens, user: sanitizedUser };
  }
}
