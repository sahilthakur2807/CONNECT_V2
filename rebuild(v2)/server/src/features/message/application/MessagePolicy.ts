import type { UserContext, CommunityMembershipContext } from '../../../shared/policies/Policy.js';

export class MessagePolicy {
  private static isSiteAdmin(user: UserContext): boolean {
    return user.role === 'admin' || user.role === 'superadmin';
  }

  /**
   * Checks if a user is permitted to send a message.
   * Restricts muted or banned members.
   */
  static canSend(user: UserContext, communityMembership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;

    if (communityMembership) {
      if (communityMembership.banned) return false;
      if (communityMembership.muted) return false; // Muted members cannot post messages
    }

    return true; // Users can message in global/non-community rooms if authenticated
  }

  /**
   * Checks if a user is permitted to modify (edit, soft-delete, or restore) a message.
   * Only the author or a site-wide admin can perform these actions.
   */
  static canMutate(user: UserContext, messageAuthorId: string): boolean {
    if (this.isSiteAdmin(user)) return true;
    return user.id === messageAuthorId;
  }
}
