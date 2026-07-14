import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RegisterHandler,
  RegisterCommand,
} from "../src/features/auth/application/commands/RegisterHandler.js";
import {
  LoginHandler,
  LoginCommand,
} from "../src/features/auth/application/commands/LoginHandler.js";
import {
  RefreshTokenHandler,
  RefreshTokenCommand,
} from "../src/features/auth/application/commands/RefreshTokenHandler.js";
import {
  VerifyEmailHandler,
  VerifyEmailCommand,
} from "../src/features/auth/application/commands/VerifyEmailHandler.js";
import {
  RequestPasswordResetHandler,
  ResetPasswordHandler,
  RequestPasswordResetCommand,
  ResetPasswordCommand,
} from "../src/features/auth/application/commands/PasswordResetHandler.js";
import {
  RevokeSessionHandler,
  RevokeSessionCommand,
} from "../src/features/auth/application/commands/RevokeSessionHandler.js";
import {
  OAuthSignInHandler,
  OAuthSignInCommand,
} from "../src/features/auth/application/commands/OAuthSignInHandler.js";

import { AuthService } from "../src/features/auth/application/AuthService.js";
import { Hash } from "../src/shared/utils/Hash.js";
import {
  UnauthorizedError,
  BadRequestError,
} from "../src/shared/errors/AppError.js";

describe("CONNECT IAM Subsystem Unit Tests", () => {
  let mockUserRepo;
  let mockSessionRepo;
  let authService;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockUserRepo = {
      findById: vi.fn().mockImplementation(async (id) => ({
        id,
        username: "mock_user",
        email: "mock@example.com",
        role: "user",
        status: "online",
      })),
      findByEmail: vi.fn(),
      findByUsername: vi.fn(),
      findByEmailOrUsername: vi.fn(),
      findByVerificationToken: vi.fn(),
      findByResetToken: vi.fn(),
      findByOAuth: vi.fn(),
      linkOAuthAccount: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockSessionRepo = {
      create: vi.fn(),
      findByToken: vi.fn(),
      findActiveByUserId: vi.fn(),
      revokeSession: vi.fn(),
      revokeAllForUser: vi.fn(),
      revokeOthersForUser: vi.fn(),
    };

    authService = new AuthService(mockSessionRepo, mockUserRepo);
  });

  // 1. Password Hash test
  it("should hash and compare passwords correctly using Argon2id", async () => {
    const raw = "my-secure-password";
    const hash = await Hash.hash(raw);
    expect(hash).toBeDefined();
    expect(hash).toContain("$argon2id$");

    const isMatch = await Hash.compare(raw, hash);
    expect(isMatch).toBe(true);

    const isBadMatch = await Hash.compare("wrong-password", hash);
    expect(isBadMatch).toBe(false);
  });

  // 2. User Registration use-case
  it("should register a new user successfully when inputs are valid", async () => {
    const handler = new RegisterHandler(mockUserRepo, authService);
    const command = new RegisterCommand(
      "johndoe",
      "john@example.com",
      "password123",
    );

    mockUserRepo.findByEmailOrUsername.mockResolvedValue(null);
    mockUserRepo.create.mockResolvedValue({
      id: "usr_1",
      username: "johndoe",
      email: "john@example.com",
      role: "user",
      status: "online",
    });

    const result = await handler.execute(command);
    expect(mockUserRepo.create).toHaveBeenCalled();
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.user.username).toBe("johndoe");
  });

  it("should fail registration if username is in reserved list", async () => {
    const handler = new RegisterHandler(mockUserRepo, authService);
    const command = new RegisterCommand(
      "admin",
      "admin@example.com",
      "password123",
    );

    await expect(handler.execute(command)).rejects.toThrow(BadRequestError);
  });

  // 3. User Login use-case & Account Lockout
  it("should login successfully with correct credentials", async () => {
    const handler = new LoginHandler(mockUserRepo, authService);
    const passwordHash = await Hash.hash("secret123");
    mockUserRepo.findByEmailOrUsername.mockResolvedValue({
      id: "usr_1",
      username: "user1",
      email: "user1@example.com",
      password: passwordHash,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      role: "user",
    });

    const command = new LoginCommand("user1", "secret123");
    const result = await handler.execute(command);

    expect(result.tokens.accessToken).toBeDefined();
    expect(mockUserRepo.update).toHaveBeenCalledWith("usr_1", {
      failedLoginAttempts: 0,
      lockoutUntil: null,
      status: "online",
    });
  });

  it("should trigger lockout after 5 failed login attempts", async () => {
    const handler = new LoginHandler(mockUserRepo, authService);
    const passwordHash = await Hash.hash("correct-password");
    mockUserRepo.findByEmailOrUsername.mockResolvedValue({
      id: "usr_1",
      username: "user1",
      email: "user1@example.com",
      password: passwordHash,
      failedLoginAttempts: 4, // 5th failure incoming
      lockoutUntil: null,
      role: "user",
    });

    const command = new LoginCommand("user1", "wrong-password");
    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedError);
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({
        failedLoginAttempts: 5,
        lockoutUntil: expect.any(Date),
      }),
    );
  });

  // 4. Token Rotation Use-case
  it("should rotate session successfully with valid token", async () => {
    const handler = new RefreshTokenHandler(authService);
    const command = new RefreshTokenCommand("valid-refresh-token");

    mockSessionRepo.findByToken.mockResolvedValue({
      id: "sess_123",
      token: "valid-refresh-token",
      userId: "usr_1",
      revoked: false,
      expiresAt: new Date(Date.now() + 100000),
    });
    mockUserRepo.findById.mockResolvedValue({
      id: "usr_1",
      email: "john@example.com",
      username: "john",
      role: "user",
    });

    const result = await handler.execute(command);
    expect(result.accessToken).toBeDefined();
    expect(mockSessionRepo.revokeSession).toHaveBeenCalledWith(
      "sess_123",
      undefined,
    );
    expect(mockSessionRepo.create).toHaveBeenCalled();
  });

  it("should revoke all sessions if a revoked refresh token is replayed", async () => {
    const handler = new RefreshTokenHandler(authService);
    const command = new RefreshTokenCommand("replayed-refresh-token");

    mockSessionRepo.findByToken.mockResolvedValue({
      id: "sess_123",
      token: "replayed-refresh-token",
      userId: "usr_1",
      revoked: true, // Already spent
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedError);
    expect(mockSessionRepo.revokeAllForUser).toHaveBeenCalledWith(
      "usr_1",
      undefined,
    );
  });

  // 5. Verification use-case
  it("should verify email successfully when token is valid", async () => {
    const handler = new VerifyEmailHandler(mockUserRepo);
    const command = new VerifyEmailCommand("valid-verify-token");

    mockUserRepo.findByVerificationToken.mockResolvedValue({
      id: "usr_1",
      username: "john",
    });

    const result = await handler.execute(command);
    expect(result.success).toBe(true);
    expect(mockUserRepo.update).toHaveBeenCalledWith("usr_1", {
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      verified: true,
    });
  });

  // 6. Forgot and Reset Password use-cases
  it("should generate reset token for valid email", async () => {
    const handler = new RequestPasswordResetHandler(mockUserRepo);
    const command = new RequestPasswordResetCommand("user@example.com");

    mockUserRepo.findByEmail.mockResolvedValue({
      id: "usr_1",
      email: "user@example.com",
    });

    const result = await handler.execute(command);
    expect(result.success).toBe(true);
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({
        passwordResetToken: expect.any(String),
        passwordResetTokenExpires: expect.any(Date),
      }),
    );
  });

  it("should reset password and revoke all active sessions", async () => {
    const handler = new ResetPasswordHandler(mockUserRepo, mockSessionRepo);
    const command = new ResetPasswordCommand(
      "valid-reset-token",
      "newPassword123",
    );

    mockUserRepo.findByResetToken.mockResolvedValue({
      id: "usr_1",
      username: "john",
    });

    const result = await handler.execute(command);
    expect(result.success).toBe(true);
    expect(mockUserRepo.update).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({
        password: expect.any(String),
      }),
    );
    expect(mockSessionRepo.revokeAllForUser).toHaveBeenCalledWith("usr_1");
  });

  // 7. Revoke Session use-case
  it("should revoke a single current session successfully", async () => {
    const handler = new RevokeSessionHandler(mockSessionRepo, mockUserRepo);
    const command = new RevokeSessionCommand("usr_1", "current", "curr-token");

    mockSessionRepo.findByToken.mockResolvedValue({
      id: "sess_1",
      userId: "usr_1",
    });
    mockSessionRepo.findActiveByUserId.mockResolvedValue([]);

    const result = await handler.execute(command);
    expect(result.success).toBe(true);
    expect(mockSessionRepo.revokeSession).toHaveBeenCalledWith("sess_1");
  });

  // 8. Pluggable Google OAuth Login/Signup
  it("should authenticate via Google OAuth and link email if user exists", async () => {
    const handler = new OAuthSignInHandler(mockUserRepo, authService);
    const command = new OAuthSignInCommand(
      "google",
      "mock-google-token:oauth@example.com",
    );

    mockUserRepo.findByOAuth.mockResolvedValue(null);
    mockUserRepo.findByEmail.mockResolvedValue({
      id: "usr_oauth",
      username: "oauth_user",
      email: "oauth@example.com",
      role: "user",
    });

    const result = await handler.execute(command);
    expect(result.tokens.accessToken).toBeDefined();
    expect(mockUserRepo.linkOAuthAccount).toHaveBeenCalledWith(
      "usr_oauth",
      "google",
      "google-uid-oauth@example.com",
    );
  });
});
