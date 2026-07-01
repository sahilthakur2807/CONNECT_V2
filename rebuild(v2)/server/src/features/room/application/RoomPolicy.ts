import type { UserContext, CommunityMembershipContext } from '../../../shared/policies/Policy.js';

export class RoomPolicy {
  private static isSiteAdmin(user: UserContext): boolean {
    return user.role === 'admin' || user.role === 'superadmin';
  }

  /**
   * Checks if a user is permitted to create a room.
   */
  static canCreateRoom(user: UserContext, communityId?: string, membership?: CommunityMembershipContext): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (communityId) {
      // Community-based room: requires active membership and not banned
      return !!membership && !membership.banned;
    }
    return true; // Global/Article rooms can be created by any user
  }

  /**
   * Checks if a user is permitted to edit, delete, or archive a room.
   */
  static canMutateRoom(
    user: UserContext,
    roomCreatorId: string | null,
    communityOwnerId?: string | null,
    communityMembership?: CommunityMembershipContext
  ): boolean {
    if (this.isSiteAdmin(user)) return true;
    if (roomCreatorId && user.id === roomCreatorId) return true;
    
    // Community level authorizations
    if (communityOwnerId && user.id === communityOwnerId) return true;
    if (communityMembership && (communityMembership.role === 'owner' || communityMembership.role === 'admin' || communityMembership.role === 'moderator')) {
      return true;
    }
    return false;
  }
}
