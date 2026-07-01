import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  sidebarCollapsed: false,
  activeCategory: "All Topics",
  socketConnected: false,
  activeRoomId: null,
  activeCommunityId: null,
  unreadNotificationsCount: 0,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarCollapsed: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },
    setActiveCategory: (state, action) => {
      state.activeCategory = action.payload;
    },
    setSocketConnected: (state, action) => {
      state.socketConnected = action.payload;
    },
    setActiveRoomId: (state, action) => {
      state.activeRoomId = action.payload;
    },
    setActiveCommunityId: (state, action) => {
      state.activeCommunityId = action.payload;
    },
    setUnreadNotificationsCount: (state, action) => {
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
