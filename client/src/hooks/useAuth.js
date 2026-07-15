import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  setAccessToken,
  setUser,
  setLoading,
  setError,
  logout as logoutAction,
  clearError as clearErrorAction,
  setUserRestriction,
} from "@/store/slices/authSlice";
import { apiClient } from "@/services/apiClient";
import { connectSocket, disconnectSocket } from "@/services/socketService";
import { useNavigate } from "react-router";

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, accessToken, isLoading, error } = useAppSelector(
    (state) => state.auth,
  );

  const login = useCallback(async (identifier, password) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await apiClient.post("/auth/login", {
        identifier,
        password,
      });
      const { accessToken: token, user: userData, userRestriction } = response.data.data;
      dispatch(setAccessToken(token));
      dispatch(setUser(userData));
      dispatch(setUserRestriction(userRestriction || null));
      connectSocket();
      return userData;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Login failed";
      dispatch(setError(errMsg));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const register = useCallback(async (username, email, password) => {
    dispatch(setLoading(true));
    dispatch(setError(null));
    try {
      const response = await apiClient.post("/auth/register", {
        username,
        email,
        password,
      });
      const { accessToken: token, user: userData, userRestriction } = response.data.data;
      dispatch(setAccessToken(token));
      dispatch(setUser(userData));
      dispatch(setUserRestriction(userRestriction || null));
      connectSocket();
      return userData;
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message || "Registration failed";
      dispatch(setError(errMsg));
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const logout = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      await apiClient.post("/auth/logout", { scope: "current" });
    } catch (err) {
      console.error("Logout error on server:", err);
    } finally {
      dispatch(logoutAction());
      disconnectSocket();
      dispatch(setLoading(false));
      navigate("/");
    }
  }, [dispatch, navigate]);

  const refreshSession = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const refreshResponse = await apiClient.post("/auth/refresh");
      const { accessToken: token, user: userData, userRestriction } = refreshResponse.data.data;
      dispatch(setAccessToken(token));
      if (userData) {
        dispatch(setUser(userData));
      }
      dispatch(setUserRestriction(userRestriction || null));
      connectSocket();
      return token;
    } catch (err) {
      dispatch(logoutAction());
      throw err;
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch(clearErrorAction());
  }, [dispatch]);

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

