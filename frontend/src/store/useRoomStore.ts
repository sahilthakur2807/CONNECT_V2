import { useCallback } from 'react';
import { store, useAppDispatch, useAppSelector } from './index';
import {
  fetchRooms as fetchRoomsThunk,
  fetchTrendingRooms as fetchTrendingRoomsThunk,
  openRoom as openRoomThunk,
  joinRoom as joinRoomThunk,
  leaveRoom as leaveRoomThunk,
  createRoom as createRoomThunk,
  fetchMessages as fetchMessagesThunk,
  sendMessage as sendMessageThunk,
  editMessage as editMessageThunk,
  removeMessage as removeMessageThunk,
  toggleReaction as toggleReactionThunk,
  closeRoom as closeRoomAction,
  clearError as clearErrorAction,
  addMessage as addMessageAction,
  updateMessageInList as updateMessageInListAction,
  removeMessageFromList as removeMessageFromListAction,
} from './slices/roomSlice';
import type { Room, Message } from '@/types';

interface UseRoomStore {
  (): {
    rooms: Room[];
    trendingRooms: Room[];
    isLoadingRooms: boolean;
    currentRoom: Room | null;
    messages: Message[];
    isLoadingMessages: boolean;
    error: string | null;
    fetchRooms: (params?: Record<string, string>) => Promise<void>;
    fetchTrendingRooms: () => Promise<void>;
    openRoom: (id: string) => Promise<void>;
    closeRoom: () => void;
    joinRoom: (id: string) => Promise<void>;
    leaveRoom: (id: string) => Promise<void>;
    createRoom: (data: Parameters<typeof api_createRoom_dummy>[0]) => Promise<Room>;
    fetchMessages: (roomId: string) => Promise<void>;
    sendMessage: (roomId: string, content: string, parentId?: string) => Promise<Message>;
    editMessage: (id: string, content: string) => Promise<void>;
    removeMessage: (id: string) => Promise<void>;
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    addMessage: (message: Message) => void;
    updateMessageInList: (message: Message) => void;
    removeMessageFromList: (id: string) => void;
    clearError: () => void;
  };
  getState: () => {
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    editMessage: (id: string, content: string) => Promise<void>;
    removeMessage: (id: string) => Promise<void>;
  };
}

const useRoomStoreHook = () => {
  const dispatch = useAppDispatch() as any;
  const state = useAppSelector((s) => s.rooms);

  const fetchRooms = useCallback(async (params?: Record<string, string>) => {
    await dispatch(fetchRoomsThunk(params)).unwrap();
  }, [dispatch]);

  const fetchTrendingRooms = useCallback(async () => {
    await dispatch(fetchTrendingRoomsThunk()).unwrap();
  }, [dispatch]);

  const openRoom = useCallback(async (id: string) => {
    await dispatch(openRoomThunk(id)).unwrap();
  }, [dispatch]);

  const closeRoom = useCallback(() => {
    dispatch(closeRoomAction());
  }, [dispatch]);

  const joinRoom = useCallback(async (id: string) => {
    await dispatch(joinRoomThunk(id)).unwrap();
  }, [dispatch]);

  const leaveRoom = useCallback(async (id: string) => {
    await dispatch(leaveRoomThunk(id)).unwrap();
  }, [dispatch]);

  const createRoom = useCallback(async (data: Parameters<typeof api_createRoom_dummy>[0]) => {
    return await dispatch(createRoomThunk(data)).unwrap();
  }, [dispatch]);

  const fetchMessages = useCallback(async (roomId: string) => {
    await dispatch(fetchMessagesThunk(roomId)).unwrap();
  }, [dispatch]);

  const sendMessage = useCallback(async (roomId: string, content: string, parentId?: string) => {
    return await dispatch(sendMessageThunk({ roomId, content, parentId })).unwrap();
  }, [dispatch]);

  const editMessage = useCallback(async (id: string, content: string) => {
    await dispatch(editMessageThunk({ id, content })).unwrap();
  }, [dispatch]);

  const removeMessage = useCallback(async (id: string) => {
    await dispatch(removeMessageThunk(id)).unwrap();
  }, [dispatch]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    await dispatch(toggleReactionThunk({ messageId, emoji })).unwrap();
  }, [dispatch]);

  const addMessage = useCallback((message: Message) => {
    dispatch(addMessageAction(message));
  }, [dispatch]);

  const updateMessageInList = useCallback((message: Message) => {
    dispatch(updateMessageInListAction(message));
  }, [dispatch]);

  const removeMessageFromList = useCallback((id: string) => {
    dispatch(removeMessageFromListAction(id));
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearErrorAction());
  }, [dispatch]);

  return {
    ...state,
    fetchRooms,
    fetchTrendingRooms,
    openRoom,
    closeRoom,
    joinRoom,
    leaveRoom,
    createRoom,
    fetchMessages,
    sendMessage,
    editMessage,
    removeMessage,
    toggleReaction,
    addMessage,
    updateMessageInList,
    removeMessageFromList,
    clearError,
  };
};

// Dummy type extractor for Parameters utility
const api_createRoom_dummy = {} as any as (data: {
  title: string;
  description: string;
  category: string;
  tags?: string[];
  sourceUrl?: string;
}) => Promise<Room>;

export const useRoomStore = useRoomStoreHook as UseRoomStore;

// Support static/non-React access, such as from click handlers in MessageCard
useRoomStore.getState = () => {
  return {
    toggleReaction: async (messageId: string, emoji: string) => {
      await (store.dispatch as any)(toggleReactionThunk({ messageId, emoji })).unwrap();
    },
    editMessage: async (id: string, content: string) => {
      await (store.dispatch as any)(editMessageThunk({ id, content })).unwrap();
    },
    removeMessage: async (id: string) => {
      await (store.dispatch as any)(removeMessageThunk(id)).unwrap();
    },
  };
};
