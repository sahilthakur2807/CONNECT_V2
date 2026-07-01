import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  roomId: string | null;
  referenceId: string | null;
  createdAt: string;
  userId: string;
  triggerId: string | null;
  status: string | null;
  trigger?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export function useNotifications() {
  const queryClient = useQueryClient();

  const useNotificationsQuery = (limit = 20, cursor?: string) =>
    useQuery<Notification[]>({
      queryKey: ['notifications', { limit, cursor }],
      queryFn: async () => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        if (cursor) params.append('cursor', cursor);
        const res = await apiClient.get<{ success: boolean; data: Notification[] }>(
          `/notifications?${params.toString()}`
        );
        return res.data.data;
      },
      refetchInterval: 10000,
    });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch<{ success: boolean; data: Notification }>(`/notifications/${id}/read`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return {
    useNotificationsQuery,
    markReadMutation,
    markAllReadMutation,
  };
}
