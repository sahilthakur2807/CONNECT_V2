import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Friend {
  id: string;
  username: string;
  name: string | null;
  avatar: string | null;
  status: string; // 'online' | 'offline'
  lastSeen: string | null;
}

export interface PendingRequest {
  id: string;
  status: string; // 'pending'
  createdAt: string;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  };
}

export function useSocial() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useFriendsQuery = () =>
    useQuery<Friend[]>({
      queryKey: ['friends'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Friend[] }>('/friends');
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const usePendingRequestsQuery = () =>
    useQuery<PendingRequest[]>({
      queryKey: ['friends', 'pending'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: PendingRequest[] }>('/friends/pending');
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  // --- Mutations ---

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await apiClient.post<{ success: boolean; data: any }>('/friends/requests', {
        targetUserId,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiClient.post<{ success: boolean; data: any }>(`/friends/requests/${requestId}/accept`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiClient.post(`/friends/requests/${requestId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    },
  });

  const cancelFriendRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      await apiClient.delete(`/friends/requests/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId: string) => {
      await apiClient.delete(`/friends/${friendId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.post<{ success: boolean; data: any }>(`/blocks/${userId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/blocks/${userId}`);
    },
  });

  return {
    useFriendsQuery,
    usePendingRequestsQuery,
    sendFriendRequestMutation,
    acceptFriendRequestMutation,
    rejectFriendRequestMutation,
    cancelFriendRequestMutation,
    removeFriendMutation,
    blockUserMutation,
    unblockUserMutation,
  };
}
