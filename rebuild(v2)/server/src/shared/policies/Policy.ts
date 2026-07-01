export interface UserContext {
  id: string;
  role: string; // Site-wide roles: user, moderator, admin, superadmin
}

export interface CommunityMembershipContext {
  role: string; // Community-level roles: owner, admin, moderator, member
  banned: boolean;
  muted: boolean;
}
