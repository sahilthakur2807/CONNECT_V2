import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useUserStatsQuery = (userId) =>
  useQuery({
    queryKey: ["analytics", "user", userId, "stats"],
    queryFn: async () => {
      if (!userId) throw new Error("User ID required");
      const res = await apiClient.get(`/users/${userId}/stats`);
      return res.data.data;
    },
    enabled: !!userId,
  });

export const useUserFeedQuery = (userId, limit = 20, cursor) =>
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

export const useUserContributionsQuery = (userId) =>
  useQuery({
    queryKey: ["analytics", "user", userId, "contributions"],
    queryFn: async () => {
      if (!userId) throw new Error("User ID required");
      const res = await apiClient.get(`/users/${userId}/contributions`);
      return res.data.data;
    },
    enabled: !!userId,
  });

export const useUserCategoryContributionsQuery = (userId) =>
  useQuery({
    queryKey: ["analytics", "user", userId, "category-contributions"],
    queryFn: async () => {
      if (!userId) throw new Error("User ID required");
      const res = await apiClient.get(`/users/${userId}/category-contributions`);
      return res.data.data;
    },
    enabled: !!userId,
  });

export const useCommunityStatsQuery = (communityId) =>
  useQuery({
    queryKey: ["analytics", "community", communityId, "stats"],
    queryFn: async () => {
      if (!communityId) throw new Error("Community ID required");
      const res = await apiClient.get(`/communities/${communityId}/stats`);
      return res.data.data;
    },
    enabled: !!communityId,
  });

export const useCommunityFeedQuery = (communityId, limit = 20, cursor) =>
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

export const useAdminMetricsQuery = (startDate, endDate) =>
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

// --- Standalone Mutations ---

export const useAwardReputationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
};

// --- Backward Compatible Wrapper Hook ---

export function useAnalytics() {
  return {
    useUserStatsQuery,
    useUserFeedQuery,
    useUserContributionsQuery,
    useUserCategoryContributionsQuery,
    useCommunityStatsQuery,
    useCommunityFeedQuery,
    useAdminMetricsQuery,
    awardReputationMutation: useAwardReputationMutation(),
  };
}
