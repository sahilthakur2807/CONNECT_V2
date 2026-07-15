import { createSlice } from "@reduxjs/toolkit";

const getPersistedUserId = () => {
  try {
    return localStorage.getItem("newsconnect_user_id");
  } catch {
    return null;
  }
};

const initialState = {
  userId: getPersistedUserId(),
  accessToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: getPersistedUserId() !== null,
  userRestriction: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessToken: (state, action) => {
      state.accessToken = action.payload;
    },
    setUser: (state, action) => {
      state.userId = action.payload ? action.payload.id : null;
      state.isAuthenticated = action.payload !== null;
      if (action.payload) {
        localStorage.setItem(
          "newsconnect_user_id",
          action.payload.id,
        );
      } else {
        localStorage.removeItem("newsconnect_user_id");
        state.userRestriction = null;
      }
    },
    setUserRestriction: (state, action) => {
      state.userRestriction = action.payload;
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.userId = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.userRestriction = null;
      localStorage.removeItem("newsconnect_user_id");
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setAccessToken,
  setUser,
  setUserRestriction,
  setLoading,
  setError,
  logout,
  clearError,
} = authSlice.actions;
export default authSlice.reducer;
