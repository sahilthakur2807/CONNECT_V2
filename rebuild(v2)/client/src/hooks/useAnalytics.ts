import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface UserStats {
  messagesSent: number;
  communitiesJoined: number;
  roomsJoined: number;
  friends: number;
  accountAgeDays: number;
}

export interface ActivityFeedItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  metadata?: any;
}

export function useAnalytics() {
  const queryClient = useQueryClient();

  const useUserStatsQuery = (userId?: string) =>
    useQuery<UserStats>({
      queryKey: ['analytics', 'user', userId, 'stats'],
      queryFn: async () => {
        if (!userId) throw new Error('User ID required');
        const res = await apiClient.get<{ success: boolean; data: UserStats }>(`/users/${userId}/stats`);
        return res.data.data;
      },
      enabled: !!userId,
    });

  const useUserFeedQuery = (userId?: string, limit = 20, cursor?: string) =>
    useQuery<ActivityFeedItem[]>({
      queryKey: ['analytics', 'user', userId, 'feed', { limit, cursor }],
      queryFn: async () => {
        if (!userId) throw new Error('User ID required');
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        if (cursor) params.append('cursor', cursor);
        const res = await apiClient.get<{ success: boolean; data: ActivityFeedItem[] }>(
          `/users/${userId}/feed?${params.toString()}`
        );
        return res.data.data;
      },
      enabled: !!userId,
    });

  const useCommunityStatsQuery = (communityId?: string) =>
    useQuery<any>({
      queryKey: ['analytics', 'community', communityId, 'stats'],
      queryFn: async () => {
        if (!communityId) throw new Error('Community ID required');
        const res = await apiClient.get<{ success: boolean; data: any }>(`/communities/${communityId}/stats`);
        return res.data.data;
      },
      enabled: !!communityId,
    });

  const useCommunityFeedQuery = (communityId?: string, limit = 20, cursor?: string) =>
    useQuery<ActivityFeedItem[]>({
      queryKey: ['analytics', 'community', communityId, 'feed', { limit, cursor }],
      queryFn: async () => {
        if (!communityId) throw new Error('Community ID required');
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        if (cursor) params.append('cursor', cursor);
        const res = await apiClient.get<{ success: boolean; data: ActivityFeedItem[] }>(
          `/communities/${communityId}/feed?${params.toString()}`
        );
        return res.data.data;
      },
      enabled: !!communityId,
    });

  const useAdminMetricsQuery = (startDate?: string, endDate?: string) =>
    useQuery<any>({
      queryKey: ['analytics', 'admin', 'metrics', { startDate, endDate }],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        const res = await apiClient.get<{ success: boolean; data: any }>(`/admin/metrics?${params.toString()}`);
        return res.data.data;
      },
    });

  const awardReputationMutation = useMutation({
    mutationFn: async (data: { targetUserId: string; amount: number; reason: string }) => {
      const res = await apiClient.post<{ success: boolean; data: any }>('/moderation/reputation', data);
      return res.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['analytics', 'user', variables.targetUserId] });
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
