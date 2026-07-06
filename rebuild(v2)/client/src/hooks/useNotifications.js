import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useNotificationsQuery = (limit = 20, cursor, options = {}) =>
  useQuery({
    queryKey: ["notifications", { limit, cursor }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("limit", limit.toString());
      if (cursor) params.append("cursor", cursor);
      const res = await apiClient.get(`/notifications?${params.toString()}`);
      return res.data.data;
    },
    ...options,
  });

// --- Standalone Mutations ---

export const useMarkReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.patch(`/notifications/${id}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useMarkAllReadMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

// --- Backward Compatible Wrapper Hook ---

export function useNotifications() {
  return {
    useNotificationsQuery,
    markReadMutation: useMarkReadMutation(),
    markAllReadMutation: useMarkAllReadMutation(),
  };
}
