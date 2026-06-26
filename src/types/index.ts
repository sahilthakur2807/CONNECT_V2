// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'user' | 'moderator' | 'admin' | 'superadmin';
export type UserStatus = 'online' | 'offline';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  role: UserRole;
  status: UserStatus;
  verified: boolean;
  reputation: number;
  badges: string[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
    rooms: number;
    communities?: number;
    createdRooms?: number;
  };
}

// ─── Community ───────────────────────────────────────────────────────────────

export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  banner: string | null;
  createdAt: string;
  _count?: {
    members: number;
    rooms: number;
  };
}

// ─── Room ────────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  imageUrl: string | null;
  sourceUrl: string | null;
  trending: boolean;
  isNew: boolean;
  communityId: string | null;
  community?: Community;
  createdAt: string;
  updatedAt: string;
  _count?: {
    members: number;
    messages: number;
  };
}

// ─── Reaction ────────────────────────────────────────────────────────────────

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
  createdAt: string;
  user?: User;
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  content: string;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  roomId: string;
  parentId: string | null;
  user: User;
  reactions: Reaction[];
  replies: Message[];
}

// ─── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  roomId: string | null;
  referenceId: string | null;
  createdAt: string;
  userId: string;
  triggerId: string | null;
  trigger?: User;
}

// ─── Report ──────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  reason: string;
  description: string;
  status: ReportStatus;
  severity: string;
  createdAt: string;
  reporterId: string;
  reporter?: User;
  reportedUserId: string | null;
  reportedUser?: User;
  messageId: string | null;
  message?: Message;
  roomId: string | null;
  room?: Room;
}

// ─── Activity ────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  userId: string;
  roomId: string;
  actionType: string;
  createdAt: string;
  user?: User;
  room?: Room;
}
