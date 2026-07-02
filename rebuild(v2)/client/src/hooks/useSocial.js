import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useFriendsQuery = () =>
  useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await apiClient.get("/friends");
      return res.data.data;
    },
    refetchInterval: 10000,
  });

export const usePendingRequestsQuery = () =>
  useQuery({
    queryKey: ["friends", "pending"],
    queryFn: async () => {
      const res = await apiClient.get("/friends/pending");
      return res.data.data;
    },
    refetchInterval: 10000,
  });

// --- Standalone Mutations ---

export const useSendFriendRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
};

export const useAcceptFriendRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId) => {
      const res = await apiClient.post(`/friends/requests/${requestId}/accept`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });
};

export const useRejectFriendRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId) => {
      await apiClient.post(`/friends/requests/${requestId}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });
};

export const useCancelFriendRequestMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId) => {
      await apiClient.delete(`/friends/requests/${requestId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });
};

export const useRemoveFriendMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendId) => {
      await apiClient.delete(`/friends/${friendId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
};

export const useBlockUserMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId) => {
      const res = await apiClient.post(`/blocks/${userId}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      queryClient.invalidateQueries({ queryKey: ["friends", "pending"] });
    },
  });
};

export const useUnblockUserMutation = () => {
  return useMutation({
    mutationFn: async (userId) => {
      await apiClient.delete(`/blocks/${userId}`);
    },
  });
};

// --- Backward Compatible Wrapper Hook ---

export function useSocial() {
  return {
    useFriendsQuery,
    usePendingRequestsQuery,
    sendFriendRequestMutation: useSendFriendRequestMutation(),
    acceptFriendRequestMutation: useAcceptFriendRequestMutation(),
    rejectFriendRequestMutation: useRejectFriendRequestMutation(),
    cancelFriendRequestMutation: useCancelFriendRequestMutation(),
    removeFriendMutation: useRemoveFriendMutation(),
    blockUserMutation: useBlockUserMutation(),
    unblockUserMutation: useUnblockUserMutation(),
  };
}
