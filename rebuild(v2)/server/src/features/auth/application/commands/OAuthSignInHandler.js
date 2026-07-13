import crypto from "crypto";
import { googleOAuthProvider } from "../../infrastructure/oauth/GoogleOAuthProvider.js";
import { BadRequestError } from "../../../../shared/errors/AppError.js";
import { EventBus } from "../../../../shared/event-bus/EventBus.js";

const OAUTH_PROVIDERS = {
  google: googleOAuthProvider,
};

export class OAuthSignInCommand {
  constructor(provider, token, deviceInfo, ipAddress) {
    this.provider = provider;
    this.token = token;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
  }
}

export class OAuthSignInSuccessEvent {
  eventName = "auth.oauth.success";
  occurredAt = new Date();
  constructor(userId, provider, ipAddress) {
    this.userId = userId;
    this.provider = provider;
    this.ipAddress = ipAddress;
  }
}

export class OAuthSignInHandler {
  constructor(userRepo, authService) {
    this.userRepo = userRepo;
    this.authService = authService;
  }

  async execute(command) {
    const providerName = command.provider.toLowerCase();
    const provider = OAUTH_PROVIDERS[providerName];

    if (!provider) {
      throw new BadRequestError(
        `OAuth provider "${command.provider}" is not supported`,
      );
    }

    // 1. Verify token with provider
    const oauthPayload = await provider.verifyToken(command.token);
    const sanitizedEmail = oauthPayload.email.trim().toLowerCase();

    // 2. Check if a linked OAuth account exists
    let user = await this.userRepo.findByOAuth(
      providerName,
      oauthPayload.providerUserId,
    );

    if (user) {
      // User exists, start session
      const tokens = await this.authService.createSession(
        user.id,
        command.deviceInfo,
        command.ipAddress,
      );
      await EventBus.publish(
        new OAuthSignInSuccessEvent(user.id, providerName, command.ipAddress),
      );

      const { password: _, verificationToken: __, ...sanitizedUser } = user;
      return { tokens, user: sanitizedUser };
    }

    // 3. User with linked account not found, check if a user with same email exists
    const existingUser = await this.userRepo.findByEmail(sanitizedEmail);

    if (existingUser) {
      // User exists, link OAuth account
      await this.userRepo.linkOAuthAccount(
        existingUser.id,
        providerName,
        oauthPayload.providerUserId,
      );
      const tokens = await this.authService.createSession(
        existingUser.id,
        command.deviceInfo,
        command.ipAddress,
      );
      await EventBus.publish(
        new OAuthSignInSuccessEvent(
          existingUser.id,
          providerName,
          command.ipAddress,
        ),
      );

      const {
        password: _,
        verificationToken: __,
        ...sanitizedUser
      } = existingUser;
      return { tokens, user: sanitizedUser };
    }

    // 4. Email does not exist, auto-signup new user
    // Generate unique username based on email prefix
    let baseUsername = sanitizedEmail
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "");
    if (baseUsername.length < 3) baseUsername = "user_" + baseUsername;
    let username = baseUsername;
    let attempts = 0;
    while (attempts < 10) {
      const collisionUser = await this.userRepo.findByUsername(username);
      if (!collisionUser) break;
      username = `${baseUsername}_${crypto.randomInt(1000, 9999)}`;
      attempts++;
    }

    // Create new password (randomly generated)
    const randomPassword = crypto.randomBytes(32).toString("hex");
    // Argon2id hash of random password
    const hashedPassword = await crypto.randomBytes(32).toString("hex"); // Placeholder password hash

    const newUser = await this.userRepo.create({
      username,
      email: sanitizedEmail,
      password: hashedPassword,
      name: oauthPayload.name || username,
      avatar:
        oauthPayload.avatar ||
        `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`,
      role: "user",
      status: "online",
      verified: true, // Auto-verified since OAuth provider verified email
      emailVerified: true,
      reputation: 0,
      badges: ["Early Member", "Google Linked"],
    });

    // Link the new OAuth account
    await this.userRepo.linkOAuthAccount(
      newUser.id,
      providerName,
      oauthPayload.providerUserId,
    );

    const tokens = await this.authService.createSession(
      newUser.id,
      command.deviceInfo,
      command.ipAddress,
    );
    await EventBus.publish(
      new OAuthSignInSuccessEvent(newUser.id, providerName, command.ipAddress),
    );

    const { password: _, verificationToken: __, ...sanitizedUser } = newUser;
    return { tokens, user: sanitizedUser };
  }
}
