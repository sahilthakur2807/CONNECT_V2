import { prisma } from '../../../../infrastructure/db/PrismaClient.js';
import { BaseRepository } from '../../../../infrastructure/repository/BaseRepository.js';
import type { User, Prisma } from '@prisma/client';

export class UserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereUniqueInput,
  Prisma.UserWhereInput
> {
  constructor() {
    super(prisma.user, 'user');
  }

  async findByEmail(email: string, tx?: any): Promise<User | null> {
    return this.getDelegate(tx).findUnique({ where: { email } });
  }

  async findByUsername(username: string, tx?: any): Promise<User | null> {
    return this.getDelegate(tx).findUnique({ where: { username } });
  }

  /**
   * Resolves a user by checking if the identifier matches either an email or a username.
   */
  async findByEmailOrUsername(identifier: string, tx?: any): Promise<User | null> {
    const isEmail = identifier.includes('@');
    if (isEmail) {
      return this.findByEmail(identifier, tx);
    }
    return this.findByUsername(identifier, tx);
  }

  /**
   * Resolves a user that is linked to a specific OAuth provider identity.
   */
  async findByOAuth(provider: string, providerUserId: string, tx?: any): Promise<User | null> {
    const delegate = tx ? tx.oAuthAccount : prisma.oAuthAccount;
    const link = await delegate.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId }
      },
      include: { user: true }
    });
    return link ? link.user : null;
  }

  /**
   * Links an existing user to an OAuth identity record.
   */
  async linkOAuthAccount(userId: string, provider: string, providerUserId: string, tx?: any): Promise<void> {
    const delegate = tx ? tx.oAuthAccount : prisma.oAuthAccount;
    await delegate.create({
      data: {
        provider,
        providerUserId,
        userId
      }
    });
  }

  /**
   * Resolves a user by verification token if the token is not expired.
   */
  async findByVerificationToken(token: string, tx?: any): Promise<User | null> {
    return this.getDelegate(tx).findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: { gt: new Date() }
      }
    });
  }

  /**
   * Resolves a user by password reset token if the token is not expired.
   */
  async findByResetToken(token: string, tx?: any): Promise<User | null> {
    return this.getDelegate(tx).findFirst({
      where: {
        passwordResetToken: token,
        passwordResetTokenExpires: { gt: new Date() }
      }
    });
  }
}
