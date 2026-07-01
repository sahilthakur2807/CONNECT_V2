import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Message {
  id: string;
  content: string;
  edited: boolean;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
  roomId: string;
  parentId: string | null;
  clientMessageId: string | null;
  user: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
    verified?: boolean;
    role?: string;
  };
  replies?: Message[];
}

export function useMessages(roomId?: string) {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useMessagesQuery = (options?: { cursor?: string; direction?: 'before' | 'after'; limit?: number }) =>
    useQuery<Message[]>({
      queryKey: ['messages', roomId, options],
      queryFn: async () => {
        if (!roomId) return [];
        const params = new URLSearchParams();
        if (options?.cursor) params.append('cursor', options.cursor);
        if (options?.direction) params.append('direction', options.direction);
        if (options?.limit) params.append('limit', options.limit.toString());

        const res = await apiClient.get<{ success: boolean; data: Message[] }>(
          `/rooms/${roomId}/messages?${params.toString()}`
        );
        return res.data.data;
      },
      enabled: !!roomId,
    });

  const useRepliesQuery = (messageId?: string) =>
    useQuery<Message[]>({
      queryKey: ['messages', 'replies', messageId],
      queryFn: async () => {
        if (!messageId) return [];
        const res = await apiClient.get<{ success: boolean; data: Message[] }>(`/messages/${messageId}/replies`);
        return res.data.data;
      },
      enabled: !!messageId,
    });

  // --- Mutations ---

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; parentId?: string | null }) => {
      if (!roomId) throw new Error('Room ID required');
      const clientMessageId = crypto.randomUUID();
      const res = await apiClient.post<{ success: boolean; data: Message }>(`/rooms/${roomId}/messages`, {
        content: data.content,
        parentId: data.parentId || undefined,
        clientMessageId,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', roomId] });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async (data: { messageId: string; content: string }) => {
      const res = await apiClient.patch<{ success: boolean; data: Message }>(`/messages/${data.messageId}`, {
        content: data.content,
      });
      return res.data.data;
    },
    onSuccess: (updatedMessage) => {
      queryClient.invalidateQueries({ queryKey: ['messages', updatedMessage.roomId] });
      if (updatedMessage.parentId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'replies', updatedMessage.parentId] });
      }
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiClient.delete(`/messages/${messageId}`);
    },
    onSuccess: (_, messageId) => {
      queryClient.invalidateQueries({ queryKey: ['messages', roomId] });
      // Invalidate replies cache as well
      queryClient.invalidateQueries({ queryKey: ['messages', 'replies', messageId] });
    },
  });

  const restoreMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const res = await apiClient.post<{ success: boolean; data: Message }>(`/messages/${messageId}/restore`);
      return res.data.data;
    },
    onSuccess: (restoredMessage) => {
      queryClient.invalidateQueries({ queryKey: ['messages', restoredMessage.roomId] });
      if (restoredMessage.parentId) {
        queryClient.invalidateQueries({ queryKey: ['messages', 'replies', restoredMessage.parentId] });
      }
    },
  });

  return {
    useMessagesQuery,
    useRepliesQuery,
    sendMessageMutation,
    editMessageMutation,
    deleteMessageMutation,
    restoreMessageMutation,
  };
}
