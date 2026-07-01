import { useAppDispatch, useAppSelector } from '@/store';
import {
  setAccessToken,
  setUser,
  setLoading,
  setError,
  logout as logoutAction,
  clearError as clearErrorAction,
  type User,
} from '@/store/slices/authSlice';
import { apiClient } from '@/services/apiClient';
import { connectSocket, disconnectSocket } from '@/services/socketService';
import { useNavigate } from 'react-router';

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, accessToken, isLoading, error } = useAppSelector((state) => state.auth);

  const login = async (identifier: string, password: string) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await apiClient.post<{ success: boolean; data: { accessToken: string; user: User } }>(
        '/auth/login',
        { identifier, password }
      );
      const { accessToken: token, user: userData } = response.data.data;
      dispatch(setAccessToken(token));
      dispatch(setUser(userData));
      connectSocket();
      return userData;
    } catch (err: any) {
      dispatch(setError(err.message || 'Login failed'));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const register = async (username: string, email: string, password: string) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await apiClient.post<{ success: boolean; data: { accessToken: string; user: User } }>(
        '/auth/register',
        { username, email, password }
      );
      const { accessToken: token, user: userData } = response.data.data;
      dispatch(setAccessToken(token));
      dispatch(setUser(userData));
      connectSocket();
      return userData;
    } catch (err: any) {
      dispatch(setError(err.message || 'Registration failed'));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const logout = async () => {
    dispatch(setLoading(true));
    try {
      await apiClient.post('/auth/logout', { scope: 'current' });
    } catch (err) {
      console.error('Logout error on server:', err);
    } finally {
      dispatch(logoutAction());
      disconnectSocket();
      dispatch(setLoading(false));
      navigate('/auth');
    }
  };

  const refreshSession = async () => {
    dispatch(setLoading(true));
    try {
      const refreshResponse = await apiClient.post<{ success: boolean; data: { accessToken: string } }>(
        '/auth/refresh'
      );
      const token = refreshResponse.data.data.accessToken;
      dispatch(setAccessToken(token));
      
      // Let's decode or fetch the user's details if we don't have them
      if (!user) {
        // We can get details by doing search or load user details if available
        // But since we persist user details on login, if they exist in localStorage,
        // they are loaded automatically by authSlice. Let's make sure we connect socket.
      }
      connectSocket();
      return token;
    } catch (err) {
      dispatch(logoutAction());
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  };

  const clearError = () => {
    dispatch(clearErrorAction());
  };

  return {
    user,
    accessToken,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshSession,
    clearError,
  };
}
