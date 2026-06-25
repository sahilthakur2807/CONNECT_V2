import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/types';
import { connectSocket, disconnectSocket } from '@/services/socket';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const store = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem('newsconnect_token');
    if (token) {
      store
        .fetchUser()
        .then(() => {
          connectSocket();
        })
        .catch((err) => {
          if (err?.status === 401 || err?.status === 403) {
            localStorage.removeItem('newsconnect_token');
          }
        });
    } else {
      // No token — just mark loading as done
      useAuthStore.setState({ isLoading: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: store.user,
        token: store.token,
        isLoading: store.isLoading,
        error: store.error,
        login: store.login,
        register: store.register,
        logout: () => {
          store.logout();
          disconnectSocket();
        },
        updateProfile: store.updateProfile,
        clearError: store.clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
