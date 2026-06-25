import { create } from 'zustand';
import * as api from '@/services/api';
import type { Room, Message } from '@/types';

interface RoomState {
  /* List views */
  rooms: Room[];
  trendingRooms: Room[];
  isLoadingRooms: boolean;

  /* Current room */
  currentRoom: Room | null;
  messages: Message[];
  isLoadingMessages: boolean;

  error: string | null;

  /* Actions – room list */
  fetchRooms: (params?: Record<string, string>) => Promise<void>;
  fetchTrendingRooms: () => Promise<void>;

  /* Actions – single room */
  openRoom: (id: string) => Promise<void>;
  closeRoom: () => void;
  joinRoom: (id: string) => Promise<void>;
  leaveRoom: (id: string) => Promise<void>;
  createRoom: (data: Parameters<typeof api.createRoom>[0]) => Promise<Room>;

  /* Actions – messages */
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string, parentId?: string) => Promise<Message>;
  editMessage: (id: string, content: string) => Promise<void>;
  removeMessage: (id: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;

  /* Realtime helpers */
  addMessage: (message: Message) => void;
  updateMessageInList: (message: Message) => void;
  removeMessageFromList: (id: string) => void;

  clearError: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  trendingRooms: [],
  isLoadingRooms: false,

  currentRoom: null,
  messages: [],
  isLoadingMessages: false,

  error: null,

  // ── Room list ────────────────────────────────────────────────────────────

  fetchRooms: async (params) => {
    try {
      set({ isLoadingRooms: true, error: null });
      const rooms = await api.getRooms(params);
      set({ rooms, isLoadingRooms: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch rooms',
        isLoadingRooms: false,
      });
    }
  },

  fetchTrendingRooms: async () => {
    try {
      set({ isLoadingRooms: true, error: null });
      const trendingRooms = await api.getTrendingRooms();
      set({ trendingRooms, isLoadingRooms: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch trending rooms',
        isLoadingRooms: false,
      });
    }
  },

  // ── Single room ──────────────────────────────────────────────────────────

  openRoom: async (id) => {
    try {
      set({ isLoadingMessages: true, error: null });
      const [room, messages] = await Promise.all([
        api.getRoom(id),
        api.getMessages(id),
      ]);
      set({ currentRoom: room, messages, isLoadingMessages: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to open room',
        isLoadingMessages: false,
      });
    }
  },

  closeRoom: () => set({ currentRoom: null, messages: [] }),

  joinRoom: async (id) => {
    await api.joinRoom(id);
    // Refresh the room to get updated member count
    const room = await api.getRoom(id);
    if (get().currentRoom?.id === id) {
      set({ currentRoom: room });
    }
  },

  leaveRoom: async (id) => {
    await api.leaveRoom(id);
    if (get().currentRoom?.id === id) {
      set({ currentRoom: null, messages: [] });
    }
  },

  createRoom: async (data) => {
    const room = await api.createRoom(data);
    set((state) => ({ rooms: [room, ...state.rooms] }));
    return room;
  },

  // ── Messages ─────────────────────────────────────────────────────────────

  fetchMessages: async (roomId) => {
    try {
      set({ isLoadingMessages: true, error: null });
      const messages = await api.getMessages(roomId);
      set({ messages, isLoadingMessages: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch messages',
        isLoadingMessages: false,
      });
    }
  },

  sendMessage: async (roomId, content, parentId) => {
    const message = await api.createMessage(roomId, { content, parentId });
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    });
    return message;
  },

  editMessage: async (id, content) => {
    const updated = await api.updateMessage(id, { content });
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? updated : m)),
    }));
  },

  removeMessage: async (id) => {
    await api.deleteMessage(id);
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  toggleReaction: async (messageId, emoji) => {
    await api.toggleReaction(messageId, { emoji });
    // Re-fetch messages to get correct reaction state
    const { currentRoom } = get();
    if (currentRoom) {
      const messages = await api.getMessages(currentRoom.id);
      set({ messages });
    }
  },

  // ── Realtime helpers (called from socket listeners) ──────────────────────

  addMessage: (message) => {
    set((state) => {
      if (state.currentRoom?.id !== message.roomId) return state;
      // Avoid duplicates
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: [...state.messages, message] };
    });
  },

  updateMessageInList: (message) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === message.id ? message : m)),
    }));
  },

  removeMessageFromList: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  clearError: () => set({ error: null }),
}));
