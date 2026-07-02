import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useMessagesQuery = (roomId, options) =>
  useQuery({
    queryKey: ["messages", roomId, options],
    queryFn: async () => {
      if (!roomId) return [];
      const params = new URLSearchParams();
      if (options?.cursor) params.append("cursor", options.cursor);
      if (options?.direction) params.append("direction", options.direction);
      if (options?.limit) params.append("limit", options.limit.toString());

      const res = await apiClient.get(
        `/rooms/${roomId}/messages?${params.toString()}`,
      );
      return res.data.data;
    },
    enabled: !!roomId,
  });

export const useRepliesQuery = (messageId) =>
  useQuery({
    queryKey: ["messages", "replies", messageId],
    queryFn: async () => {
      if (!messageId) return [];
      const res = await apiClient.get(`/messages/${messageId}/replies`);
      return res.data.data;
    },
    enabled: !!messageId,
  });

// --- Standalone Mutations ---

export const useSendMessageMutation = (roomId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      if (!roomId) throw new Error("Room ID required");
      const clientMessageId = crypto.randomUUID();
      const res = await apiClient.post(`/rooms/${roomId}/messages`, {
        content: data.content,
        parentId: data.parentId || undefined,
        clientMessageId,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
    },
  });
};

export const useEditMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.patch(`/messages/${data.messageId}`, {
        content: data.content,
      });
      return res.data.data;
    },
    onSuccess: (updatedMessage) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", updatedMessage.roomId],
      });
      if (updatedMessage.parentId) {
        queryClient.invalidateQueries({
          queryKey: ["messages", "replies", updatedMessage.parentId],
        });
      }
    },
  });
};

export const useDeleteMessageMutation = (roomId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId) => {
      await apiClient.delete(`/messages/${messageId}`);
    },
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ["messages", roomId] });
      queryClient.invalidateQueries({
        queryKey: ["messages", "replies", messageId],
      });
    },
  });
};

export const useRestoreMessageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId) => {
      const res = await apiClient.post(`/messages/${messageId}/restore`);
      return res.data.data;
    },
    onSuccess: (restoredMessage) => {
      queryClient.invalidateQueries({
        queryKey: ["messages", restoredMessage.roomId],
      });
      if (restoredMessage.parentId) {
        queryClient.invalidateQueries({
          queryKey: ["messages", "replies", restoredMessage.parentId],
        });
      }
    },
  });
};

// --- Backward Compatible Wrapper Hook ---

export function useMessages(roomId) {
  return {
    useMessagesQuery: (options) => useMessagesQuery(roomId, options),
    useRepliesQuery,
    sendMessageMutation: useSendMessageMutation(roomId),
    editMessageMutation: useEditMessageMutation(),
    deleteMessageMutation: useDeleteMessageMutation(roomId),
    restoreMessageMutation: useRestoreMessageMutation(),
  };
}
