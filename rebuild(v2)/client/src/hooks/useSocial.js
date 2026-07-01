import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useSocial() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useFriendsQuery = () =>
    useQuery({
      queryKey: ["friends"],
      queryFn: async () => {
        const res = await apiClient.get("/friends");
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const usePendingRequestsQuery = () =>
    useQuery({
      queryKey: ["friends", "pending"],
      queryFn: async () => {
        const res = await apiClient.get("/friends/pending");
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  // --- Mutations ---

  const sendFriendRequestMutation = useMutation({
    mutationFn: async (targetUserId) => {
      const res = await apiClient.post("/friends/requests", {
        targetUserId,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });

  const acceptFriendRequestMutation = useMutation({
    mutationFn: async (requestId) => {
      const res = await apiClient.post(`/friends/requests/${requestId}/accept`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });

  const rejectFriendRequestMutation = useMutation({
    mutationFn: async (requestId) => {
      await apiClient.post(`/friends/requests/${requestId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });

  const cancelFriendRequestMutation = useMutation({
    mutationFn: async (requestId) => {
      await apiClient.delete(`/friends/requests/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendId) => {
      await apiClient.delete(`/friends/${friendId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });

  const blockUserMutation = useMutation({
    mutationFn: async (userId) => {
      const res = await apiClient.post(`/blocks/${userId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId) => {
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
