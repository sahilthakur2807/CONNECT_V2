import axios from "axios";
import { store } from "@/store";
import { setAccessToken, logout } from "@/store/slices/authSlice";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Crucial for HTTP-only refresh token cookies
});

// Request Interceptor: Attach the access token from Redux state
apiClient.interceptors.request.use(
  (config) => {
    const token = store.getState().auth.accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle automatic token refresh and global error formatting
apiClient.interceptors.response.use(
  (response) => {
    // If the backend response is wrapped in { success: true, data: ... }, unwrap it
    if (
      response.data &&
      typeof response.data === "object" &&
      "success" in response.data
    ) {
      return response;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors (session expiration/invalid access token)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const isAuthRoute =
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/register") ||
        originalRequest.url?.includes("/auth/refresh") ||
        originalRequest.url?.includes("/auth/forgot-password") ||
        originalRequest.url?.includes("/auth/reset-password");

      // Avoid token refresh cycle for authentication endpoints
      if (isAuthRoute) {
        if (originalRequest.url?.includes("/auth/refresh")) {
          store.dispatch(logout());
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          "/api/auth/refresh",
          {},
          { withCredentials: true },
        );

        const newAccessToken = refreshResponse.data.data.accessToken;
        store.dispatch(setAccessToken(newAccessToken));
        processQueue(null, newAccessToken);
        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }

    // Format server error payloads consistently
    const serverError = error.response?.data;
    const formattedError = new Error(
      serverError?.error?.message ||
        serverError?.message ||
        error.message ||
        "Request failed",
    );
    formattedError.status = error.response?.status;
    formattedError.code = serverError?.error?.code || "API_ERROR";
    formattedError.details = serverError?.error?.details || null;
    return Promise.reject(formattedError);
  },
);
