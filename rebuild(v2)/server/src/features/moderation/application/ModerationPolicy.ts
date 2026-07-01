import type { UserContext, CommunityMembershipContext } from '../../../shared/policies/Policy.js';

export class ModerationPolicy {
  private static isSiteAdmin(user: UserContext): boolean {
    return user.role === 'admin' || user.role === 'superadmin';
  }

  /**
   * Evaluates if a user can execute platform-wide actions (bans, suspensions).
   */
  static canExecutePlatformAction(user: UserContext): boolean {
    return this.isSiteAdmin(user);
  }

  /**
   * Evaluates if a user can execute community-specific moderation (mute, ban, warn).
   */
  static canExecuteCommunityAction(user: UserContext, communityMembership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    
    if (communityMembership) {
      const isModOrAbove = ['owner', 'admin', 'moderator'].includes(communityMembership.role);
      if (isModOrAbove && !communityMembership.banned && !communityMembership.muted) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Evaluates if a user is permitted to manage reports (assigning/resolving).
   */
  static canManageReport(user: UserContext, communityMembership?: CommunityMembershipContext): boolean {
    return this.canExecuteCommunityAction(user, communityMembership);
  }

  /**
   * Evaluates if a user can resolve appeals.
   */
  static canResolveAppeal(user: UserContext, communityMembership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (communityMembership && ['owner', 'admin'].includes(communityMembership.role)) {
      return true;
    }
    return false;
  }

  /**
   * Evaluates if a user can view system-wide audit logs.
   */
  static canViewAuditLogs(user: UserContext): boolean {
    return this.isSiteAdmin(user);
  }
}
