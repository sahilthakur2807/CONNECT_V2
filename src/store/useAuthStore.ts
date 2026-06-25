import { create } from 'zustand';
import * as api from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('newsconnect_token'),
  isLoading: true,
  error: null,

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const { token, user } = await api.login({ email, password });
      set({ token, user, isLoading: false });
      document.cookie = `newsconnect_token=${token}; path=/; max-age=604800; SameSite=Lax;`;
      connectSocket();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async (username, email, password) => {
    try {
      set({ isLoading: true, error: null });
      const { token, user } = await api.register({ username, email, password });
      set({ token, user, isLoading: false });
      document.cookie = `newsconnect_token=${token}; path=/; max-age=604800; SameSite=Lax;`;
      connectSocket();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('newsconnect_token');
    document.cookie = 'newsconnect_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;';
    disconnectSocket();
    set({ user: null, token: null, isLoading: false, error: null });
  },

  fetchUser: async () => {
    try {
      set({ isLoading: true, error: null });
      const user = await api.getMe();
      set({ user, token: localStorage.getItem('newsconnect_token'), isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch user';
      const status = (err as any).status;
      if (status === 401 || status === 403) {
        set({ user: null, token: null, error: message, isLoading: false });
        localStorage.removeItem('newsconnect_token');
      } else {
        set({ error: message, isLoading: false });
      }
      throw err;
    }
  },

  updateProfile: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const user = await api.updateProfile(data);
      set({ user, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
