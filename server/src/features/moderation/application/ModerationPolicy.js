export class ModerationPolicy {
  static isSiteAdmin(user) {
    const role = user.role?.toUpperCase();
    return role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPERADMIN";
  }

  /**
   * Legacy support for unit tests
   */
  static canExecutePlatformAction(user) {
    return this.isSiteAdmin(user);
  }

  /**
   * Evaluates if a user can execute platform-wide actions (bans, suspensions).
   * Platform admins can execute any action.
   * Platform moderators can warn, mute, and temp-ban, but CANNOT permanently ban.
   */
  static canExecutePlatformModeration(user, type, expiresAt) {
    if (this.isSiteAdmin(user)) return true;
    const role = user.role?.toUpperCase();
    if (role === "PLATFORM_MOD" || role === "MODERATOR") {
      if (type === "ban" && !expiresAt) return false; // Cannot permanently ban
      return ["warn", "mute", "ban", "suspend"].includes(type);
    }
    return false;
  }

  /**
   * Evaluates if a user can execute community-specific moderation (mute, ban, warn).
   */
  static canExecuteCommunityAction(user, communityMembership) {
    if (this.isSiteAdmin(user)) return true;
    if (communityMembership && !communityMembership.banned && !communityMembership.muted) {
      const role = communityMembership.role?.toUpperCase();
      return ["OWNER", "ADMIN", "MODERATOR"].includes(role);
    }
    return false;
  }

  /**
   * Evaluates if a user is permitted to manage reports (assigning/resolving).
   */
  static canManageReport(user, communityMembership) {
    return this.canExecuteCommunityAction(user, communityMembership);
  }

  /**
   * Evaluates if a user can resolve appeals.
   */
  static canResolveAppeal(user) {
    return this.isSiteAdmin(user);
  }

  /**
   * Evaluates if a user can view audit logs.
   */
  static canViewAuditLogs(user) {
    const role = user.role?.toUpperCase();
    return ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(role);
  }

  /**
   * Evaluates if an actor's role is permitted to moderate a target user's role.
   */
  static canModerateUser(actorRole, targetRole) {
    const actor = actorRole?.toUpperCase();
    const target = targetRole?.toUpperCase();

    const getRoleLevel = (r) => {
      if (["SUPER_ADMIN", "SUPERADMIN"].includes(r)) return 4;
      if (["PLATFORM_ADMIN", "ADMIN"].includes(r)) return 3;
      if (["PLATFORM_MOD", "MODERATOR"].includes(r)) return 2;
      return 1;
    };

    const actorLevel = getRoleLevel(actor);
    const targetLevel = getRoleLevel(target);

    if (targetLevel === 4) {
      return actorLevel === 4;
    }
    if (targetLevel === 3) {
      return actorLevel === 4;
    }
    if (targetLevel === 2) {
      return actorLevel >= 3;
    }
    if (targetLevel === 1) {
      return true;
    }
    return false;
  }
}
