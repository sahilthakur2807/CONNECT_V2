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
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, accessToken, isLoading, error } = useAppSelector(
    (state) => state.auth,
  );

  const { data: userProfile } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const res = await apiClient.get(`/users/${userId}`);
      return res.data.data;
    },
    enabled: !!userId && !!accessToken,
  });

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
      queryClient.setQueryData(["user", userData.id], userData);
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
  }, [dispatch, queryClient]);

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
      queryClient.setQueryData(["user", userData.id], userData);
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
  }, [dispatch, queryClient]);

  const logout = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      await apiClient.post("/auth/logout", { scope: "current" });
    } catch (err) {
      console.error("Logout error on server:", err);
    } finally {
      queryClient.removeQueries({ queryKey: ["user"] });
      dispatch(logoutAction());
      disconnectSocket();
      dispatch(setLoading(false));
      navigate("/");
    }
  }, [dispatch, navigate, queryClient]);

  const refreshSession = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const refreshResponse = await apiClient.post("/auth/refresh");
      const { accessToken: token, user: userData, userRestriction } = refreshResponse.data.data;
      dispatch(setAccessToken(token));
      if (userData) {
        queryClient.setQueryData(["user", userData.id], userData);
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
  }, [dispatch, queryClient]);

  const clearError = useCallback(() => {
    dispatch(clearErrorAction());
  }, [dispatch]);

  return {
    user: userProfile || null,
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

