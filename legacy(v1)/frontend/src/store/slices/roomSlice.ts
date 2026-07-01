import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as api from '@/services/api';
import type { Room, Message } from '@/types';

interface RoomState {
  rooms: Room[];
  trendingRooms: Room[];
  isLoadingRooms: boolean;

  currentRoom: Room | null;
  messages: Message[];
  isLoadingMessages: boolean;

  error: string | null;
}

const initialState: RoomState = {
  rooms: [],
  trendingRooms: [],
  isLoadingRooms: false,

  currentRoom: null,
  messages: [],
  isLoadingMessages: false,

  error: null,
};

export const fetchRooms = createAsyncThunk(
  'rooms/fetchRooms',
  async (params: Record<string, string> | undefined, { rejectWithValue }) => {
    try {
      const data = await api.getRooms(params);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch rooms');
    }
  }
);

export const fetchTrendingRooms = createAsyncThunk(
  'rooms/fetchTrendingRooms',
  async (_, { rejectWithValue }) => {
    try {
      const data = await api.getTrendingRooms();
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch trending rooms');
    }
  }
);

export const openRoom = createAsyncThunk(
  'rooms/openRoom',
  async (id: string, { rejectWithValue }) => {
    try {
      const [room, messages] = await Promise.all([
        api.getRoom(id),
        api.getMessages(id),
      ]);
      return { room, messages };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to open room');
    }
  }
);

export const joinRoom = createAsyncThunk(
  'rooms/joinRoom',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.joinRoom(id);
      const room = await api.getRoom(id);
      return { id, room };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to join room');
    }
  }
);

export const leaveRoom = createAsyncThunk(
  'rooms/leaveRoom',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.leaveRoom(id);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to leave room');
    }
  }
);

export const createRoom = createAsyncThunk(
  'rooms/createRoom',
  async (data: Parameters<typeof api.createRoom>[0], { rejectWithValue }) => {
    try {
      const room = await api.createRoom(data);
      return room;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create room');
    }
  }
);

export const fetchMessages = createAsyncThunk(
  'rooms/fetchMessages',
  async (roomId: string, { rejectWithValue }) => {
    try {
      const data = await api.getMessages(roomId);
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch messages');
    }
  }
);

export const sendMessage = createAsyncThunk(
  'rooms/sendMessage',
  async (
    payload: { roomId: string; content: string; parentId?: string },
    { rejectWithValue }
  ) => {
    try {
      const message = await api.createMessage(payload.roomId, {
        content: payload.content,
        parentId: payload.parentId,
      });
      return message;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to send message');
    }
  }
);

export const editMessage = createAsyncThunk(
  'rooms/editMessage',
  async (payload: { id: string; content: string }, { rejectWithValue }) => {
    try {
      const updated = await api.updateMessage(payload.id, { content: payload.content });
      return updated;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to edit message');
    }
  }
);

export const removeMessage = createAsyncThunk(
  'rooms/removeMessage',
  async (id: string, { rejectWithValue }) => {
    try {
      await api.deleteMessage(id);
      return id;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete message');
    }
  }
);

export const toggleReaction = createAsyncThunk(
  'rooms/toggleReaction',
  async (payload: { messageId: string; emoji: string }, { rejectWithValue }) => {
    try {
      await api.toggleReaction(payload.messageId, { emoji: payload.emoji });
      return payload;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to toggle reaction');
    }
  }
);

const roomSlice = createSlice({
  name: 'rooms',
  initialState,
  reducers: {
    closeRoom: (state) => {
      state.currentRoom = null;
      state.messages = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      if (state.currentRoom?.id !== action.payload.roomId) return;
      if (state.messages.some((m) => m.id === action.payload.id)) return;
      state.messages.push(action.payload);
    },
    updateMessageInList: (state, action: PayloadAction<Message>) => {
      state.messages = state.messages.map((m) =>
        m.id === action.payload.id ? action.payload : m
      );
    },
    removeMessageFromList: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((m) => m.id !== action.payload);
    },
    patchRoomStats: (state, action: PayloadAction<{ roomId: string; memberCount?: number; messageCount?: number; activeNow?: number }>) => {
      const { roomId, memberCount, messageCount, activeNow } = action.payload;
      // Patch currentRoom
      if (state.currentRoom?.id === roomId) {
        if (!state.currentRoom._count) (state.currentRoom as any)._count = {};
        if (memberCount !== undefined) (state.currentRoom as any)._count.members = memberCount;
        if (messageCount !== undefined) (state.currentRoom as any)._count.messages = messageCount;
        if (activeNow !== undefined) (state.currentRoom as any).activeNow = activeNow;
      }
      // Patch rooms list
      state.rooms = state.rooms.map(r => {
        if (r.id !== roomId) return r;
        const updated = { ...r, _count: { ...(r as any)._count } } as any;
        if (memberCount !== undefined) updated._count.members = memberCount;
        if (messageCount !== undefined) updated._count.messages = messageCount;
        if (activeNow !== undefined) updated.activeNow = activeNow;
        return updated;
      });
      // Patch trendingRooms list
      state.trendingRooms = state.trendingRooms.map(r => {
        if (r.id !== roomId) return r;
        const updated = { ...r, _count: { ...(r as any)._count } } as any;
        if (memberCount !== undefined) updated._count.members = memberCount;
        if (messageCount !== undefined) updated._count.messages = messageCount;
        if (activeNow !== undefined) updated.activeNow = activeNow;
        return updated;
      });
    },
  },
  extraReducers: (builder) => {
    // Fetch Rooms
    builder.addCase(fetchRooms.pending, (state) => {
      state.isLoadingRooms = true;
      state.error = null;
    });
    builder.addCase(fetchRooms.fulfilled, (state, action) => {
      state.rooms = action.payload;
      state.isLoadingRooms = false;
    });
    builder.addCase(fetchRooms.rejected, (state, action) => {
      state.isLoadingRooms = false;
      state.error = action.payload as string;
    });

    // Fetch Trending Rooms
    builder.addCase(fetchTrendingRooms.pending, (state) => {
      state.isLoadingRooms = true;
      state.error = null;
    });
    builder.addCase(fetchTrendingRooms.fulfilled, (state, action) => {
      state.trendingRooms = action.payload;
      state.isLoadingRooms = false;
    });
    builder.addCase(fetchTrendingRooms.rejected, (state, action) => {
      state.isLoadingRooms = false;
      state.error = action.payload as string;
    });

    // Open Room
    builder.addCase(openRoom.pending, (state) => {
      state.isLoadingMessages = true;
      state.error = null;
    });
    builder.addCase(openRoom.fulfilled, (state, action) => {
      state.currentRoom = action.payload.room;
      state.messages = action.payload.messages;
      state.isLoadingMessages = false;
    });
    builder.addCase(openRoom.rejected, (state, action) => {
      state.isLoadingMessages = false;
      state.error = action.payload as string;
    });

    // Join Room
    builder.addCase(joinRoom.fulfilled, (state, action) => {
      const { id, room } = action.payload;
      if (state.currentRoom?.id === id) {
        state.currentRoom = room;
      }
    });

    // Leave Room
    builder.addCase(leaveRoom.fulfilled, (state, action) => {
      const id = action.payload;
      if (state.currentRoom?.id === id) {
        state.currentRoom = null;
        state.messages = [];
      }
    });

    // Create Room
    builder.addCase(createRoom.fulfilled, (state, action) => {
      state.rooms.unshift(action.payload);
    });

    // Fetch Messages
    builder.addCase(fetchMessages.pending, (state) => {
      state.isLoadingMessages = true;
      state.error = null;
    });
    builder.addCase(fetchMessages.fulfilled, (state, action) => {
      state.messages = action.payload;
      state.isLoadingMessages = false;
    });
    builder.addCase(fetchMessages.rejected, (state, action) => {
      state.isLoadingMessages = false;
      state.error = action.payload as string;
    });

    // Send Message
    builder.addCase(sendMessage.fulfilled, (state, action) => {
      if (state.messages.some((m) => m.id === action.payload.id)) return;
      state.messages.push(action.payload);
    });

    // Edit Message
    builder.addCase(editMessage.fulfilled, (state, action) => {
      state.messages = state.messages.map((m) =>
        m.id === action.payload.id ? action.payload : m
      );
    });

    // Remove Message
    builder.addCase(removeMessage.fulfilled, (state, action) => {
      state.messages = state.messages.filter((m) => m.id !== action.payload);
    });
  },
});

export const {
  closeRoom,
  clearError,
  addMessage,
  updateMessageInList,
  removeMessageFromList,
  patchRoomStats,
} = roomSlice.actions;
export default roomSlice.reducer;
