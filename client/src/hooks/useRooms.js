import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { useEffect } from "react";
import { getSocket } from "@/services/socketService";

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

export const useRoomsQuery = (filters, options = {}) =>
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
      if (filters?.includeWorldChat)
        params.append("includeWorldChat", filters.includeWorldChat.toString());
      const res = await apiClient.get(`/rooms?${params.toString()}`);
      return res.data.data;
    },
    ...options,
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

export const useTrendingRoomsQuery = (limit = 20, options = {}) =>
  useQuery({
    queryKey: ["rooms", "trending", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/trending?limit=${limit}`);
      return {
        rooms: res.data.data,
        total: parseInt(res.headers["x-total-count"] || "0", 10),
      };
    },
    placeholderData: keepPreviousData,
    ...options,
  });

export const useHotRoomsQuery = (limit = 20, options = {}) =>
  useQuery({
    queryKey: ["rooms", "hot", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/hot?limit=${limit}`);
      return {
        rooms: res.data.data,
        total: parseInt(res.headers["x-total-count"] || "0", 10),
      };
    },
    placeholderData: keepPreviousData,
    ...options,
  });

export const useNewRoomsQuery = (limit = 20, options = {}) =>
  useQuery({
    queryKey: ["rooms", "new", limit],
    queryFn: async () => {
      const res = await apiClient.get(`/rooms/new?limit=${limit}`);
      return {
        rooms: res.data.data,
        total: parseInt(res.headers["x-total-count"] || "0", 10),
      };
    },
    placeholderData: keepPreviousData,
    ...options,
  });

export const useCategoriesQuery = () =>
  useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await apiClient.get("/rooms/categories");
      return res.data.data;
    },
    staleTime: 60000,
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

import { useAppDispatch } from "@/store";
import { addOptimisticContribution, rollbackOptimisticContribution } from "@/store/slices/reputationSlice";

export const useCreateRoomMutation = () => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/rooms", data);
      return res.data.data;
    },
    onMutate: async (data) => {
      if (data.category) {
        dispatch(addOptimisticContribution({ category: data.category, type: "room" }));
      }
    },
    onError: (err, data) => {
      if (data.category) {
        dispatch(rollbackOptimisticContribution());
      }
    },
    onSuccess: (newRoom) => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      if (newRoom?.communityId) {
        queryClient.invalidateQueries({
          queryKey: ["communities", newRoom.communityId],
        });
      }

      if (newRoom && newRoom.id) {
        const activeQueries = queryClient.getQueryCache().findAll({
          queryKey: ["rooms"],
        });

        activeQueries.forEach((query) => {
          queryClient.setQueryData(query.queryKey, (oldData) => {
            if (!oldData) return oldData;

            const filters = query.queryKey[1];
            if (filters && typeof filters === "object") {
              if (
                filters.category &&
                filters.category !== "All Topics" &&
                filters.category !== newRoom.category
              ) {
                return oldData;
              }
              if (
                filters.communityId &&
                filters.communityId !== newRoom.communityId
              ) {
                return oldData;
              }
            }

            if (Array.isArray(oldData)) {
              if (oldData.some((r) => r.id === newRoom.id)) return oldData;
              return [newRoom, ...oldData];
            }

            if (oldData.rooms && Array.isArray(oldData.rooms)) {
              if (oldData.rooms.some((r) => r.id === newRoom.id)) return oldData;
              return {
                ...oldData,
                rooms: [newRoom, ...oldData.rooms],
                total: (oldData.total || oldData.rooms.length) + 1,
              };
            }

            return oldData;
          });
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
    onSuccess: (data, roomId) => {
      // Direct cache updates for instant synchronization
      queryClient.setQueriesData({ queryKey: ["rooms"] }, (old) => {
        if (!old) return old;
        
        // Single room query match
        if (old.id === roomId) {
          return { ...old, isJoined: data.isJoined, isPending: data.isPending };
        }
        
        // Array of rooms query match
        if (Array.isArray(old)) {
          return old.map((room) =>
            room.id === roomId
              ? { ...room, isJoined: data.isJoined, isPending: data.isPending }
              : room
          );
        }
        
        // Paginated items query match
        if (old.items && Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.map((room) =>
              room.id === roomId
                ? { ...room, isJoined: data.isJoined, isPending: data.isPending }
                : room
            ),
          };
        }

        // Trending/Hot/New structure query match
        if (old.rooms && Array.isArray(old.rooms)) {
          return {
            ...old,
            rooms: old.rooms.map((room) =>
              room.id === roomId
                ? { ...room, isJoined: data.isJoined, isPending: data.isPending }
                : room
            ),
          };
        }
        
        return old;
      });

      // Background refetch for synchronization assurance
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
    onSuccess: (data, roomId) => {
      // Direct cache updates for instant synchronization
      queryClient.setQueriesData({ queryKey: ["rooms"] }, (old) => {
        if (!old) return old;
        
        // Single room query match
        if (old.id === roomId) {
          return { ...old, isJoined: false, isPending: false };
        }
        
        // Array of rooms query match
        if (Array.isArray(old)) {
          return old.map((room) =>
            room.id === roomId
              ? { ...room, isJoined: false, isPending: false }
              : room
          );
        }
        
        // Paginated items query match
        if (old.items && Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.map((room) =>
              room.id === roomId
                ? { ...room, isJoined: false, isPending: false }
                : room
            ),
          };
        }

        // Trending/Hot/New structure query match
        if (old.rooms && Array.isArray(old.rooms)) {
          return {
            ...old,
            rooms: old.rooms.map((room) =>
              room.id === roomId
                ? { ...room, isJoined: false, isPending: false }
                : room
            ),
          };
        }
        
        return old;
      });

      // Background refetch for synchronization assurance
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
    useCategoriesQuery,
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

export function useRoomDiscoverySocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();

    const handleRoomCreated = (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
      }
    };

    const handleRoomUpdated = (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
        if (res.data?.id) {
          queryClient.invalidateQueries({ queryKey: ["rooms", res.data.id] });
        }
      }
    };

    const handleRoomArchived = (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
        if (res.roomId) {
          queryClient.invalidateQueries({ queryKey: ["rooms", res.roomId] });
        }
      }
    };

    const handleRoomDeleted = (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ["rooms"] });
        if (res.roomId) {
          queryClient.invalidateQueries({ queryKey: ["rooms", res.roomId] });
        }
      }
    };

    socket.on("room.created", handleRoomCreated);
    socket.on("room.updated", handleRoomUpdated);
    socket.on("room.archived", handleRoomArchived);
    socket.on("room.deleted", handleRoomDeleted);

    return () => {
      socket.off("room.created", handleRoomCreated);
      socket.off("room.updated", handleRoomUpdated);
      socket.off("room.archived", handleRoomArchived);
      socket.off("room.deleted", handleRoomDeleted);
    };
  }, [queryClient]);
}
