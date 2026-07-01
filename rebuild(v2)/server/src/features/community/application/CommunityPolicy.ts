import type { UserContext, CommunityMembershipContext } from '../../../shared/policies/Policy.js';

export class CommunityPolicy {
  /**
   * Helper to check if a user possesses site-wide administrative rights.
   */
  private static isSiteAdmin(user: UserContext): boolean {
    return user.role === 'admin' || user.role === 'superadmin';
  }

  /**
   * Evaluates if a user can edit community metadata settings.
   */
  static canUpdate(user: UserContext, ownerId: string, membership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (user.id === ownerId) return true;
    if (membership && (membership.role === 'owner' || membership.role === 'admin')) return true;
    return false;
  }

  /**
   * Evaluates if a user can soft-delete a community.
   */
  static canDelete(user: UserContext, ownerId: string): boolean {
    if (this.isSiteAdmin(user)) return true;
    return user.id === ownerId;
  }

  /**
   * Evaluates if a user can archive a community.
   */
  static canArchive(user: UserContext, ownerId: string): boolean {
    if (this.isSiteAdmin(user)) return true;
    return user.id === ownerId;
  }

  /**
   * Evaluates if a user can promote/demote or kick community members.
   */
  static canManageMembers(user: UserContext, membership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (membership && (membership.role === 'owner' || membership.role === 'admin')) return true;
    return false;
  }

  /**
   * Evaluates if a user has ban or mute capabilities (owners, admins, and moderators).
   */
  static canBanOrMute(user: UserContext, membership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (membership && (membership.role === 'owner' || membership.role === 'admin' || membership.role === 'moderator')) {
      return true;
    }
    return false;
  }
}
