import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useCommunitiesQuery = () =>
  useQuery({
    queryKey: ["communities"],
    queryFn: async () => {
      const res = await apiClient.get("/communities");
      return res.data.data;
    },
  });

export const useCommunityQuery = (id) =>
  useQuery({
    queryKey: ["communities", id],
    queryFn: async () => {
      const res = await apiClient.get(`/communities/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

export const useRoomsQuery = (filters) =>
  useQuery({
    queryKey: ["rooms", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.communityId)
        params.append("communityId", filters.communityId);
      if (filters?.category && filters.category !== "All Topics")
        params.append("category", filters.category);
      if (filters?.page) params.append("page", filters.page.toString());
      if (filters?.limit) params.append("limit", filters.limit.toString());
      const res = await apiClient.get(`/rooms?${params.toString()}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

export const useRoomQuery = (id) =>
  useQuery({
    queryKey: ["rooms", id],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/${id}`);
      return res.data.data;
    },
    enabled: !!id,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const useTrendingRoomsQuery = (limit = 20) =>
  useQuery({
    queryKey: ["rooms", "trending", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/trending?limit=${limit}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

export const useHotRoomsQuery = (limit = 20) =>
  useQuery({
    queryKey: ["rooms", "hot", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/hot?limit=${limit}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

export const useNewRoomsQuery = (limit = 20) =>
  useQuery({
    queryKey: ["rooms", "new", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/new?limit=${limit}`);
      return res.data.data;
    },
    refetchInterval: 10000,
  });

// --- Standalone Mutations ---

export const useCreateCommunityMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/communities", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });
};

export const useJoinCommunityMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId) => {
      await apiClient.post(`/communities/${communityId}/join`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities", communityId] });
    },
  });
};

export const useLeaveCommunityMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId) => {
      await apiClient.post(`/communities/${communityId}/leave`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities", communityId] });
    },
  });
};

export const useCreateRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/rooms", data);
      return res.data.data;
    },
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      if (newRoom.communityId) {
        queryClient.invalidateQueries({
          queryKey: ["communities", newRoom.communityId],
        });
      }
    },
  });
};

export const useJoinRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId) => {
      const res = await apiClient.post(`/rooms/${roomId}/join`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
};

export const useLeaveRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId) => {
      const res = await apiClient.post(`/rooms/${roomId}/leave`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
};

export const useDeleteRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId) => {
      await apiClient.delete(`/rooms/${roomId}`);
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
};

export const useArchiveRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (roomId) => {
      const res = await apiClient.post(`/rooms/${roomId}/archive`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });
};

export const useUpdateRoomMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, data }) => {
      const res = await apiClient.patch(`/rooms/${roomId}`, data);
      return res.data.data;
    },
    onSuccess: (updatedRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", updatedRoom.id] });
    },
  });
};

export const usePendingMembersQuery = (roomId) =>
  useQuery({
    queryKey: ["rooms", roomId, "pending-members"],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/${roomId}/pending-members`);
      return res.data.data;
    },
    enabled: !!roomId,
  });

export const useAcceptJoinMutation = (roomId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      await apiClient.post(`/rooms/${roomId}/accept-join`, { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId, "pending-members"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    },
  });
};

// --- Backward Compatible Wrapper Hook ---

export function useRooms() {
  const queryClient = useQueryClient();

  return {
    useCommunitiesQuery,
    useCommunityQuery,
    useRoomsQuery,
    useRoomQuery,
    useTrendingRoomsQuery,
    useHotRoomsQuery,
    useNewRoomsQuery,
    createCommunityMutation: useCreateCommunityMutation(),
    joinCommunityMutation: useJoinCommunityMutation(),
    leaveCommunityMutation: useLeaveCommunityMutation(),
    createRoomMutation: useCreateRoomMutation(),
    joinRoomMutation: useJoinRoomMutation(),
    leaveRoomMutation: useLeaveRoomMutation(),
    deleteRoomMutation: useDeleteRoomMutation(),
    archiveRoomMutation: useArchiveRoomMutation(),
    updateRoomMutation: useUpdateRoomMutation(),
    usePendingMembersQuery,
    acceptJoinMutation: useAcceptJoinMutation(),
    refreshTrendingRooms: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms", "trending"] });
    },
  };
}
