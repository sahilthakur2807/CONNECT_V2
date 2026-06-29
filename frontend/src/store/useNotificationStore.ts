import { useCallback } from 'react';
import { store, useAppDispatch, useAppSelector } from './index';
import {
  fetchNotifications as fetchNotificationsThunk,
  markRead as markReadThunk,
  markAllRead as markAllReadThunk,
  addNotification as addNotificationAction,
  clearError as clearErrorAction,
} from './slices/notificationSlice';
import type { Notification } from '@/types';

interface UseNotificationStore {
  (): {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;
    error: string | null;
    fetchNotifications: () => Promise<void>;
    markRead: (id: string) => Promise<void>;
    markAllRead: () => Promise<void>;
    clearError: () => void;
  };
  getState: () => {
    addNotification: (notification: Notification) => void;
  };
}

const useNotificationStoreHook = () => {
  const dispatch = useAppDispatch() as any;
  const state = useAppSelector((s) => s.notifications);

  const fetchNotifications = useCallback(async () => {
    await dispatch(fetchNotificationsThunk()).unwrap();
  }, [dispatch]);

  const markRead = useCallback(async (id: string) => {
    await dispatch(markReadThunk(id)).unwrap();
  }, [dispatch]);

  const markAllRead = useCallback(async () => {
    await dispatch(markAllReadThunk()).unwrap();
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearErrorAction());
  }, [dispatch]);

  return {
    ...state,
    fetchNotifications,
    markRead,
    markAllRead,
    clearError,
  };
};

export const useNotificationStore = useNotificationStoreHook as UseNotificationStore;

useNotificationStore.getState = () => {
  return {
    addNotification: (notification: Notification) => {
      store.dispatch(addNotificationAction(notification));
    },
  };
};
