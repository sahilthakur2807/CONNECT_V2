export class RoomPolicy {
  static isSiteAdmin(user) {
    return user.role === "PLATFORM_ADMIN" || user.role === "SUPER_ADMIN";
  }

  /**
   * Checks if a user is permitted to create a room.
   */
  static canCreateRoom(user, communityId, membership) {
    if (this.isSiteAdmin(user)) return true;
    if (communityId) {
      return !!membership && !membership.banned;
    }
    return true; // Global/Article rooms can be created by any authenticated user
  }

  /**
   * Checks if a user is permitted to edit or archive a room.
   */
  static canEditOrArchiveRoom(
    user,
    roomCreatorId,
    communityOwnerId,
    communityMembership,
  ) {
    if (this.isSiteAdmin(user)) return true;
    if (roomCreatorId && user.id === roomCreatorId) return true;
    
    if (communityMembership && !communityMembership.banned) {
      // Community OWNER or Community ADMIN can edit/archive rooms
      return ["OWNER", "ADMIN"].includes(communityMembership.role);
    }
    return false;
  }

  /**
   * Checks if a user is permitted to delete a room.
   */
  static canDeleteRoom(
    user,
    roomCreatorId,
    communityOwnerId,
    communityMembership,
  ) {
    if (this.isSiteAdmin(user)) return true;
    if (roomCreatorId && user.id === roomCreatorId) return true;

    if (communityMembership && !communityMembership.banned) {
      // Only Community OWNER can delete rooms (Community ADMIN/MODERATOR cannot delete)
      return communityMembership.role === "OWNER";
    }
    return false;
  }
}
