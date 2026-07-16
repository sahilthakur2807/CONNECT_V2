import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer from "./slices/authSlice";
import uiReducer from "./slices/uiSlice";
import reputationReducer from "./slices/reputationSlice";

import { disconnectSocket } from "@/services/socketService";

const socketMiddleware = () => (next) => (action) => {
  if (action.type === "auth/logout") {
    setTimeout(() => {
      disconnectSocket();
    }, 0);
  }
  return next(action);
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    reputation: reputationReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Turn off serialization check for Date objects if needed
    }).concat(socketMiddleware),
});

export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;
