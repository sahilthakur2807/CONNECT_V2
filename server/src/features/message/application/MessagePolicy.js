export class MessagePolicy {
  static isSiteAdmin(user) {
    const role = user.role?.toUpperCase();
    return role === "PLATFORM_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUPERADMIN";
  }

  /**
   * Checks if a user is permitted to send a message.
   * Restricts platform mutes, community mutes, and room-scoped mutes.
   */
  static canSend(user, communityMembership, isPlatformBanned, isPlatformMuted, isRoomMuted) {
    if (this.isSiteAdmin(user)) return true;
    if (isPlatformBanned) return false;
    if (isPlatformMuted) return false;

    // Check community membership restrictions
    if (communityMembership) {
      if (communityMembership.banned) return false;
      const role = communityMembership.role?.toUpperCase();
      if (communityMembership.muted) return false;
    }

    // Check room-specific mutes
    if (isRoomMuted) return false;

    return true;
  }

  /**
   * Only the author can edit their own message content.
   */
  static canEdit(user, messageAuthorId) {
    return user.id === messageAuthorId;
  }

  /**
   * Fallback for legacy unit tests
   */
  static canMutate(user, messageAuthorId) {
    if (this.isSiteAdmin(user)) return true;
    return user.id === messageAuthorId;
  }

  /**
   * Author, site admins/moderators, community owners/admins/moderators, and room mods can delete messages.
   */
  static canDelete(user, messageAuthorId, actorCommunityRole, actorRoomStatus) {
    if (user.id === messageAuthorId) return true;

    // Site Admins & Moderators can delete any message
    const role = user.role?.toUpperCase();
    if (["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD", "ADMIN", "SUPERADMIN", "MODERATOR"].includes(role)) {
      return true;
    }

    // Community Level checks
    const communityRole = actorCommunityRole?.toUpperCase();
    if (communityRole && ["OWNER", "ADMIN", "MODERATOR"].includes(communityRole)) {
      return true;
    }

    // Room Level check (ROOM_MOD)
    if (actorRoomStatus === "ROOM_MOD") {
      return true;
    }

    return false;
  }
}
