import * as React from 'react';
import { createContext, useContext, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  fetchUser,
  login as loginThunk,
  register as registerThunk,
  updateProfile as updateProfileThunk,
  logout as logoutAction,
  clearError as clearErrorAction,
  setLoading
} from '@/store/slices/authSlice';
import type { User } from '@/types';
import { connectSocket, disconnectSocket, getSocket } from '@/services/socket';
import { addNotification, fetchNotifications } from '@/store/slices/notificationSlice';
import { toast } from 'sonner';

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
  const dispatch = useAppDispatch() as any;
  const { user, token, isLoading, error } = useAppSelector((state) => state.auth);

  useEffect(() => {
    const localToken = localStorage.getItem('newsconnect_token');
    if (localToken) {
      dispatch(fetchUser())
        .unwrap()
        .then(() => {
          connectSocket();
        })
        .catch(() => {
          // Token is cleared inside the thunk if it fails with 401/403
        });
    } else {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!token) return;

    // Fetch initial notifications count on mount/login
    dispatch(fetchNotifications());

    const socket = getSocket();
    
    const handleNotification = (n: any) => {
      dispatch(addNotification(n));
      toast(n.title, {
        description: n.body,
        action: {
          label: 'View',
          onClick: () => {
            window.location.href = '/notifications';
          }
        }
      });
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [token, dispatch]);

  const login = async (email: string, password: string) => {
    await dispatch(loginThunk({ email, password })).unwrap();
  };

  const register = async (username: string, email: string, password: string) => {
    await dispatch(registerThunk({ username, email, password })).unwrap();
  };

  const logout = () => {
    dispatch(logoutAction());
    disconnectSocket();
  };

  const updateProfile = async (data: Partial<User>) => {
    await dispatch(updateProfileThunk(data)).unwrap();
  };

  const clearError = () => {
    dispatch(clearErrorAction());
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        login,
        register,
        logout,
        updateProfile,
        clearError,
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
