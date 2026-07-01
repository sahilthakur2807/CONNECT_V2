import type { UserContext } from '../../../shared/policies/Policy.js';

export class SocialPolicy {
  /**
   * Checks if a user is permitted to send a friend request to a target user.
   */
  static canRequestFriendship(userId: string, targetUserId: string, blockExists: boolean): boolean {
    if (userId === targetUserId) return false; // Cannot add oneself
    if (blockExists) return false; // Banned/blocked interaction is forbidden
    return true;
  }

  /**
   * Checks if a user is authorized to manage (accept, reject, cancel, remove) a friendship.
   */
  static canManageFriendship(userId: string, initiatorId: string, friendId: string): boolean {
    return userId === initiatorId || userId === friendId;
  }
}
