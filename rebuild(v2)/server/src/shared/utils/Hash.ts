import argon2 from 'argon2';
import { Logger } from '../logger/Logger.js';

export class Hash {
  /**
   * Hashes a password using Argon2id with secure defaults.
   */
  static async hash(password: string): Promise<string> {
    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,       // 3 iterations
        parallelism: 4     // 4 parallel threads
      });
    } catch (error) {
      Logger.error('Argon2 password hashing failed', error);
      throw new Error('Failed to secure password');
    }
  }

  /**
   * Compares a raw password string against an Argon2id hash.
   */
  static async compare(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      Logger.debug('Argon2 password verification failed or returned false', { error });
      return false;
    }
  }
}
