import { createSlice } from "@reduxjs/toolkit";

const getPersistedUser = () => {
  try {
    const data = localStorage.getItem("newsconnect_user");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const initialState = {
  user: getPersistedUser(),
  accessToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: getPersistedUser() !== null,
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
      state.user = action.payload;
      state.isAuthenticated = action.payload !== null;
      if (action.payload) {
        localStorage.setItem(
          "newsconnect_user",
          JSON.stringify(action.payload),
        );
      } else {
        localStorage.removeItem("newsconnect_user");
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
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      state.userRestriction = null;
      localStorage.removeItem("newsconnect_user");
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
