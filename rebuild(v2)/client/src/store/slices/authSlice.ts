import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { disconnectSocket } from '@/services/socketService';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  role: string;
  status: string;
  verified: boolean;
  reputation: number;
  badges: string[];
  createdAt: string;
  updatedAt: string;
  lastSeen?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const getPersistedUser = (): User | null => {
  try {
    const data = localStorage.getItem('newsconnect_user');
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const initialState: AuthState = {
  user: getPersistedUser(),
  accessToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: getPersistedUser() !== null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<string>) => {
      state.accessToken = action.payload;
    },
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
      if (action.payload) {
        localStorage.setItem('newsconnect_user', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('newsconnect_user');
      }
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      localStorage.removeItem('newsconnect_user');
      disconnectSocket();
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const { setAccessToken, setUser, setLoading, setError, logout, clearError } = authSlice.actions;
export default authSlice.reducer;
