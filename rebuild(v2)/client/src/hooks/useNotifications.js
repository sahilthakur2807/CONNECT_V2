import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useNotifications() {
  const queryClient = useQueryClient();

  const useNotificationsQuery = (limit = 20, cursor) =>
    useQuery({
      queryKey: ["notifications", { limit, cursor }],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append("limit", limit.toString());
        if (cursor) params.append("cursor", cursor);
        const res = await apiClient.get(`/notifications?${params.toString()}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const markReadMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.patch(`/notifications/${id}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return {
    useNotificationsQuery,
    markReadMutation,
    markAllReadMutation,
  };
}
