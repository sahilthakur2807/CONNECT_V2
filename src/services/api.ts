import axios from 'axios';
import type {
  User,
  Community,
  Room,
  Message,
  Notification,
  Report,
  Activity,
} from '@/types';

// ─── Base client ─────────────────────────────────────────────────────────────

export const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Automatically inject Authorization header if token exists in localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('newsconnect_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    const response = await apiClient.request({
      url: path,
      method: options?.method || 'GET',
      headers: options?.headers as any,
      data: options?.body ? JSON.parse(options.body as string) : undefined,
    });
    return response.data;
  } catch (error: any) {
    const errData = error.response?.data || { error: error.message };
    const err = new Error(errData.error || 'Request failed') as Error & { status?: number };
    err.status = error.response?.status;
    throw err;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: User;
}

export async function register(data: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  localStorage.setItem('newsconnect_token', result.token);
  return result;
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const result = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  localStorage.setItem('newsconnect_token', result.token);
  return result;
}

export function getMe(): Promise<User> {
  return request<User>('/auth/me');
}

export function updateProfile(data: Partial<User>): Promise<User> {
  return request<User>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Communities ─────────────────────────────────────────────────────────────

export function getCommunities(): Promise<Community[]> {
  return request<Community[]>('/communities');
}

export function getCommunity(id: string): Promise<Community> {
  return request<Community>(`/communities/${id}`);
}

export function createCommunity(data: {
  name: string;
  description: string;
  category: string;
  imageUrl?: string;
}): Promise<Community> {
  return request<Community>('/communities', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function joinCommunity(id: string): Promise<void> {
  return request<void>(`/communities/${id}/join`, { method: 'POST' });
}

export function leaveCommunity(id: string): Promise<void> {
  return request<void>(`/communities/${id}/leave`, { method: 'POST' });
}

export function getCommunityMembers(id: string): Promise<User[]> {
  return request<User[]>(`/communities/${id}/members`);
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export function getRooms(params?: Record<string, string>): Promise<Room[]> {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  return request<Room[]>(`/rooms${qs}`);
}

export function getRoom(id: string): Promise<Room> {
  return request<Room>(`/rooms/${id}`);
}

export function getTrendingRooms(): Promise<Room[]> {
  return request<Room[]>('/rooms/trending');
}

export function createRoom(data: {
  title: string;
  description: string;
  category: string;
  tags?: string[];
  communityId?: string;
  sourceUrl?: string;
  imageUrl?: string;
}): Promise<Room> {
  return request<Room>('/rooms', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function joinRoom(id: string): Promise<void> {
  return request<void>(`/rooms/${id}/join`, { method: 'POST' });
}

export function leaveRoom(id: string): Promise<void> {
  return request<void>(`/rooms/${id}/leave`, { method: 'POST' });
}

// ─── Messages ────────────────────────────────────────────────────────────────

export function getMessages(roomId: string): Promise<Message[]> {
  return request<Message[]>(`/rooms/${roomId}/messages`);
}

export function createMessage(
  roomId: string,
  data: { content: string; parentId?: string },
): Promise<Message> {
  return request<Message>(`/rooms/${roomId}/messages`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMessage(
  id: string,
  data: { content: string },
): Promise<Message> {
  return request<Message>(`/messages/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteMessage(id: string): Promise<void> {
  return request<void>(`/messages/${id}`, { method: 'DELETE' });
}

export function createReply(
  messageId: string,
  data: { content: string },
): Promise<Message> {
  return request<Message>(`/messages/${messageId}/replies`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function toggleReaction(
  messageId: string,
  data: { emoji: string },
): Promise<void> {
  return request<void>(`/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export function getUsers(): Promise<User[]> {
  return request<User[]>('/users');
}

export function getActiveUsers(): Promise<User[]> {
  return request<User[]>('/users/active');
}

export function getUser(id: string): Promise<User> {
  return request<User>(`/users/${id}`);
}

// ─── Notifications ───────────────────────────────────────────────────────────

export function getNotifications(): Promise<Notification[]> {
  return request<Notification[]>('/notifications');
}

export function markAllRead(): Promise<void> {
  return request<void>('/notifications/read', { method: 'POST' });
}

export function markRead(id: string): Promise<void> {
  return request<void>(`/notifications/${id}/read`, { method: 'POST' });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export function getReports(): Promise<Report[]> {
  return request<Report[]>('/reports');
}

export function createReport(data: {
  reason: string;
  description: string;
  severity?: string;
  reportedUserId?: string;
  messageId?: string;
  roomId?: string;
}): Promise<Report> {
  return request<Report>('/reports', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateReport(
  id: string,
  data: { status: string },
): Promise<Report> {
  return request<Report>(`/reports/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Activity ────────────────────────────────────────────────────────────────

export function getRecentActivity(): Promise<Activity[]> {
  return request<Activity[]>('/activity/recent');
}

// ─── Search ──────────────────────────────────────────────────────────────────

export interface SearchResults {
  rooms: Room[];
  users: User[];
  messages: Message[];
}

export function search(query: string): Promise<SearchResults> {
  return request<SearchResults>(
    `/search?q=${encodeURIComponent(query)}`,
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

export interface Stats {
  totalUsers: number;
  totalRooms: number;
  totalMessages: number;
  totalCommunities: number;
  activeUsers: number;
  [key: string]: unknown;
}

export function getStats(): Promise<Stats> {
  return request<Stats>('/stats');
}
