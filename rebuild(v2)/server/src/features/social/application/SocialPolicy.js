export class SocialPolicy {
  /**
   * Checks if a user is permitted to send a friend request to a target user.
   */
  static canRequestFriendship(userId, targetUserId, blockExists) {
    if (userId === targetUserId) return false; // Cannot add oneself
    if (blockExists) return false; // Banned/blocked interaction is forbidden
    return true;
  }

  /**
   * Checks if a user is authorized to manage (accept, reject, cancel, remove) a friendship.
   */
  static canManageFriendship(userId, initiatorId, friendId) {
    return userId === initiatorId || userId === friendId;
  }
}
