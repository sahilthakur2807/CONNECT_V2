import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  sidebarCollapsed: boolean;
  activeCategory: string;
  socketConnected: boolean;
  activeRoomId: string | null;
  activeCommunityId: string | null;
  unreadNotificationsCount: number;
}

const initialState: UIState = {
  sidebarCollapsed: false,
  activeCategory: 'All Topics',
  socketConnected: false,
  activeRoomId: null,
  activeCommunityId: null,
  unreadNotificationsCount: 0,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },
    setActiveCategory: (state, action: PayloadAction<string>) => {
      state.activeCategory = action.payload;
    },
    setSocketConnected: (state, action: PayloadAction<boolean>) => {
      state.socketConnected = action.payload;
    },
    setActiveRoomId: (state, action: PayloadAction<string | null>) => {
      state.activeRoomId = action.payload;
    },
    setActiveCommunityId: (state, action: PayloadAction<string | null>) => {
      state.activeCommunityId = action.payload;
    },
    setUnreadNotificationsCount: (state, action: PayloadAction<number>) => {
      state.unreadNotificationsCount = action.payload;
    },
    incrementUnreadNotificationsCount: (state) => {
      state.unreadNotificationsCount += 1;
    },
  },
});

export const {
  toggleSidebar,
  setSidebarCollapsed,
  setActiveCategory,
  setSocketConnected,
  setActiveRoomId,
  setActiveCommunityId,
  setUnreadNotificationsCount,
  incrementUnreadNotificationsCount,
} = uiSlice.actions;

export default uiSlice.reducer;
