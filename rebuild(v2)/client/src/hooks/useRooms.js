import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useRooms() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useCommunitiesQuery = () =>
    useQuery({
      queryKey: ["communities"],
      queryFn: async () => {
        const res = await apiClient.get("/communities");
        return res.data.data;
      },
    });

  const useCommunityQuery = (id) =>
    useQuery({
      queryKey: ["communities", id],
      queryFn: async () => {
        const res = await apiClient.get(`/communities/${id}`);
        return res.data.data;
      },
      enabled: !!id,
    });

  const useRoomsQuery = (filters) =>
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

  const useRoomQuery = (id) =>
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

  const useTrendingRoomsQuery = (limit = 20) =>
    useQuery({
      queryKey: ["rooms", "trending", limit],
      queryFn: async () => {
        const res = await apiClient.get(`/rooms/trending?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const useHotRoomsQuery = (limit = 20) =>
    useQuery({
      queryKey: ["rooms", "hot", limit],
      queryFn: async () => {
        const res = await apiClient.get(`/rooms/hot?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const useNewRoomsQuery = (limit = 20) =>
    useQuery({
      queryKey: ["rooms", "new", limit],
      queryFn: async () => {
        const res = await apiClient.get(`/rooms/new?limit=${limit}`);
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  // --- Mutations ---

  const createCommunityMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/communities", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
  });

  const joinCommunityMutation = useMutation({
    mutationFn: async (communityId) => {
      await apiClient.post(`/communities/${communityId}/join`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities", communityId] });
    },
  });

  const leaveCommunityMutation = useMutation({
    mutationFn: async (communityId) => {
      await apiClient.post(`/communities/${communityId}/leave`);
    },
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["communities", communityId] });
    },
  });

  const createRoomMutation = useMutation({
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

  const joinRoomMutation = useMutation({
    mutationFn: async (roomId) => {
      const res = await apiClient.post(`/rooms/${roomId}/join`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });

  const leaveRoomMutation = useMutation({
    mutationFn: async (roomId) => {
      const res = await apiClient.post(`/rooms/${roomId}/leave`);
      return res.data.data;
    },
    onSuccess: (_, roomId) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["rooms", roomId] });
    },
  });

  const refreshTrendingRooms = () => {
    // Invalidate trending rooms cache (any limit)
    queryClient.invalidateQueries({ queryKey: ["rooms", "trending"] });
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
