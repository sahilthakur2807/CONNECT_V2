export class CommunityPolicy {
  /**
   * Helper to check if a user possesses site-wide administrative rights.
   */
  static isSiteAdmin(user) {
    const role = user.role?.toUpperCase();
    return role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPERADMIN";
  }

  /**
   * Evaluates if a user can edit community metadata settings.
   */
  static canUpdate(user, ownerId, membership) {
    if (this.isSiteAdmin(user)) return true;
    if (user.id === ownerId) return true;
    if (membership) {
      const role = membership.role?.toUpperCase();
      if (role === "OWNER" || role === "ADMIN") return true;
    }
    return false;
  }

  /**
   * Evaluates if a user can soft-delete a community.
   */
  static canDelete(user, ownerId) {
    if (this.isSiteAdmin(user)) return true;
    return user.id === ownerId;
  }

  /**
   * Evaluates if a user can archive a community.
   */
  static canArchive(user, ownerId) {
    if (this.isSiteAdmin(user)) return true;
    return user.id === ownerId;
  }

  /**
   * Evaluates if a user can promote/demote or kick community members.
   */
  static canManageMembers(user, membership) {
    if (this.isSiteAdmin(user)) return true;
    if (membership) {
      const role = membership.role?.toUpperCase();
      if (role === "OWNER" || role === "ADMIN") return true;
    }
    return false;
  }

  /**
   * Evaluates if a user has ban or mute capabilities (owners, admins, and moderators).
   */
  static canBanOrMute(user, membership) {
    if (this.isSiteAdmin(user)) return true;
    if (membership) {
      const role = membership.role?.toUpperCase();
      if (role === "OWNER" || role === "ADMIN" || role === "MODERATOR") {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluates if a member can assign a specific role to another member in the community.
   */
  static canAssignCommunityRole(actorUser, actorMembership, targetRole) {
    const actorRole = actorUser.role?.toUpperCase();
    if (actorRole === "SUPER_ADMIN") return true;

    if (!actorMembership) return false;

    const actorMemRole = actorMembership.role?.toUpperCase();
    const tRole = targetRole?.toUpperCase();

    // Actor must be OWNER or ADMIN
    if (!["OWNER", "ADMIN"].includes(actorMemRole)) return false;

    // Community ADMIN cannot promote/demote ADMIN or OWNER
    if (actorMemRole === "ADMIN") {
      if (["ADMIN", "OWNER"].includes(tRole)) return false;
    }

    // Community OWNER can promote/demote ADMIN, MODERATOR, ROOM_MOD, MEMBER
    if (actorMemRole === "OWNER") {
      if (tRole === "OWNER") return false; // Demoting themselves or promoting to OWNER goes via transferOwnership
    }

    return true;
  }
}
