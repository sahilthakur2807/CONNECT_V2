import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string | null;
  banner: string | null;
  archived: boolean;
  createdAt: string;
  createdBy?: { id: string; username: string; avatar: string | null };
  _count?: { members: number; rooms: number };
}

export interface Room {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  imageUrl: string | null;
  sourceUrl: string | null;
  trending: boolean;
  isNew: boolean;
  communityId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; username: string; name: string | null; avatar: string | null };
  _count?: { members: number; messages: number };
  isJoined?: boolean;
  members?: Array<{ userId: string }>;
}

export function useRooms() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useCommunitiesQuery = () =>
    useQuery<Community[]>({
      queryKey: ['communities'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Community[] }>('/communities');
        return res.data.data;
      },
    });

  const useCommunityQuery = (id?: string) =>
    useQuery<Community>({
      queryKey: ['communities', id],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Community }>(`/communities/${id}`);
        return res.data.data;
      },
      enabled: !!id,
    });

  const useRoomsQuery = (filters?: { communityId?: string; category?: string; page?: number; limit?: number }) =>
    useQuery<Room[]>({
      queryKey: ['rooms', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters?.communityId) params.append('communityId', filters.communityId);
        if (filters?.category && filters.category !== 'All Topics') params.append('category', filters.category);
        if (filters?.page) params.append('page', filters.page.toString());
        if (filters?.limit) params.append('limit', filters.limit.toString());
        
        const res = await apiClient.get<{ success: boolean; data: Room[] }>(`/rooms?${params.toString()}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

const useRoomQuery = (id?: string) =>
  useQuery<Room>({
    queryKey: ['rooms', id],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: Room }>(
        `/rooms/${id}`
      );

      return res.data.data;
    },
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const useTrendingRoomsQuery = (limit = 20) =>
    useQuery<Room[]>({
      queryKey: ['rooms', 'trending', limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Room[] }>(`/rooms/trending?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const useHotRoomsQuery = (limit = 20) =>
    useQuery<Room[]>({
      queryKey: ['rooms', 'hot', limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Room[] }>(`/rooms/hot?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const useNewRoomsQuery = (limit = 20) =>
    useQuery<Room[]>({
      queryKey: ['rooms', 'new', limit],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Room[] }>(`/rooms/new?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  // --- Mutations ---

  const createCommunityMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string; imageUrl?: string }) => {
      const res = await apiClient.post<{ success: boolean; data: Community }>('/communities', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });

  const joinCommunityMutation = useMutation({
    mutationFn: async (communityId: string) => {
      await apiClient.post(`/communities/${communityId}/join`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
    },
  });

  const leaveCommunityMutation = useMutation({
    mutationFn: async (communityId: string) => {
      await apiClient.post(`/communities/${communityId}/leave`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
    },
  });

  const createRoomMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      category: string;
      tags?: string[];
      communityId?: string;
      sourceUrl?: string;
      imageUrl?: string;
    }) => {
      const res = await apiClient.post<{ success: boolean; data: Room }>('/rooms', data);
      return res.data.data;
    },
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      if (newRoom.communityId) {
        queryClient.invalidateQueries({ queryKey: ['communities', newRoom.communityId] });
      }
    },
  });

  const joinRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await apiClient.post<{ success: boolean; data: { isJoined: boolean } }>(`/rooms/${roomId}/join`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', roomId] });
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: async (roomId: string) => {
      const res = await apiClient.post<{ success: boolean; data: { isJoined: boolean } }>(`/rooms/${roomId}/leave`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', roomId] });
    },
  });

  const refreshTrendingRooms = () => {
    // Invalidate trending rooms cache (any limit)
    queryClient.invalidateQueries({ queryKey: ['rooms', 'trending'] });
  };

  return {
    useCommunitiesQuery,
    useCommunityQuery,
    useRoomsQuery,
    useRoomQuery,
    useTrendingRoomsQuery,
    useHotRoomsQuery,
    useNewRoomsQuery,
    createCommunityMutation,
    joinCommunityMutation,
    leaveCommunityMutation,
    createRoomMutation,
    joinRoomMutation,
    leaveRoomMutation,
    refreshTrendingRooms,
  };
}
