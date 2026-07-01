import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useAnalytics() {
  const queryClient = useQueryClient();

  const useUserStatsQuery = (userId) =>
    useQuery({
      queryKey: ["analytics", "user", userId, "stats"],
      queryFn: async () => {
        if (!userId) throw new Error("User ID required");
        const res = await apiClient.get(`/users/${userId}/stats`);
        return res.data.data;
      },
      enabled: !!userId,
    });

  const useUserFeedQuery = (userId, limit = 20, cursor) =>
    useQuery({
      queryKey: ["analytics", "user", userId, "feed", { limit, cursor }],
      queryFn: async () => {
        if (!userId) throw new Error("User ID required");
        const params = new URLSearchParams();
        params.append("limit", limit.toString());
        if (cursor) params.append("cursor", cursor);
        const res = await apiClient.get(
          `/users/${userId}/feed?${params.toString()}`,
        );
        return res.data.data;
      },
      enabled: !!userId,
    });

  const useCommunityStatsQuery = (communityId) =>
    useQuery({
      queryKey: ["analytics", "community", communityId, "stats"],
      queryFn: async () => {
        if (!communityId) throw new Error("Community ID required");
        const res = await apiClient.get(`/communities/${communityId}/stats`);
        return res.data.data;
      },
      enabled: !!communityId,
    });

  const useCommunityFeedQuery = (communityId, limit = 20, cursor) =>
    useQuery({
      queryKey: [
        "analytics",
        "community",
        communityId,
        "feed",
        { limit, cursor },
      ],
      queryFn: async () => {
        if (!communityId) throw new Error("Community ID required");
        const params = new URLSearchParams();
        params.append("limit", limit.toString());
        if (cursor) params.append("cursor", cursor);
        const res = await apiClient.get(
          `/communities/${communityId}/feed?${params.toString()}`,
        );
        return res.data.data;
      },
      enabled: !!communityId,
    });

  const useAdminMetricsQuery = (startDate, endDate) =>
    useQuery({
      queryKey: ["analytics", "admin", "metrics", { startDate, endDate }],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);
        const res = await apiClient.get(`/admin/metrics?${params.toString()}`);
        return res.data.data;
      },
    });

  const awardReputationMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/moderation/reputation", data);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["analytics", "user", variables.targetUserId],
      });
    },
  });

  return {
    useUserStatsQuery,
    useUserFeedQuery,
    useCommunityStatsQuery,
    useCommunityFeedQuery,
    useAdminMetricsQuery,
    awardReputationMutation,
  };
}
