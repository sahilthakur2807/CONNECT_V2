import { prisma } from "../../../../infrastructure/db/PrismaClient.js";
import { BaseRepository } from "../../../../infrastructure/repository/BaseRepository.js";

export class UserRepository extends BaseRepository {
  constructor() {
    super(prisma.user, "user");
  }

  async findByEmail(email, tx) {
    return this.getDelegate(tx).findUnique({ where: { email } });
  }

  async findByUsername(username, tx) {
    return this.getDelegate(tx).findUnique({ where: { username } });
  }

  /**
   * Resolves a user by checking if the identifier matches either an email or a username.
   */
  async findByEmailOrUsername(identifier, tx) {
    const isEmail = identifier.includes("@");
    if (isEmail) {
      return this.findByEmail(identifier, tx);
    }
    return this.findByUsername(identifier, tx);
  }

  /**
   * Resolves a user that is linked to a specific OAuth provider identity.
   */
  async findByOAuth(provider, providerUserId, tx) {
    const delegate = tx ? tx.oAuthAccount : prisma.oAuthAccount;
    const link = await delegate.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId },
      },
      include: { user: true },
    });
    return link ? link.user : null;
  }

  /**
   * Links an existing user to an OAuth identity record.
   */
  async linkOAuthAccount(userId, provider, providerUserId, tx) {
    const delegate = tx ? tx.oAuthAccount : prisma.oAuthAccount;
    await delegate.create({
      data: {
        provider,
        providerUserId,
        userId,
      },
    });
  }

  /**
   * Resolves a user by verification token if the token is not expired.
   */
  async findByVerificationToken(token, tx) {
    return this.getDelegate(tx).findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() },
      },
    });
  }

  /**
   * Resolves a user by password reset token if the token is not expired.
   */
  async findByResetToken(token, tx) {
    return this.getDelegate(tx).findFirst({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpires: { gt: new Date() },
      },
    });
  }
}
