import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface Report {
  id: string;
  reason: string;
  description: string;
  status: string; // 'pending' | 'assigned' | 'resolved'
  severity: string; // 'low' | 'medium' | 'high'
  createdAt: string;
  reportedUserId: string | null;
  messageId: string | null;
  roomId: string | null;
  reporter?: { username: string };
  reportedUser?: { username: string };
  message?: { content: string };
  room?: { title: string };
}

export function useModeration() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useReportsQuery = () =>
    useQuery<Report[]>({
      queryKey: ['moderation', 'reports'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: Report[] }>('/reports');
        return res.data.data;
      },
    });

  const useAppealsQuery = () =>
    useQuery<any[]>({
      queryKey: ['moderation', 'appeals'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: any[] }>('/appeals');
        return res.data.data;
      },
    });

  const useAuditLogsQuery = () =>
    useQuery<any[]>({
      queryKey: ['moderation', 'audit-logs'],
      queryFn: async () => {
        const res = await apiClient.get<{ success: boolean; data: any[] }>('/audit-logs');
        return res.data.data;
      },
    });

  // --- Mutations ---

  const submitReportMutation = useMutation({
    mutationFn: async (data: {
      reason: string;
      description: string;
      severity?: string;
      reportedUserId?: string;
      messageId?: string;
      roomId?: string;
    }) => {
      const res = await apiClient.post<{ success: boolean; data: Report }>('/reports', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'reports'] });
    },
  });

  const assignReportMutation = useMutation({
    mutationFn: async (reportId: string) => {
      const res = await apiClient.post<{ success: boolean; data: Report }>(`/reports/${reportId}/assign`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'reports'] });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async (data: { reportId: string; status: string }) => {
      const res = await apiClient.post<{ success: boolean; data: Report }>(
        `/reports/${data.reportId}/resolve`,
        { status: data.status }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'reports'] });
    },
  });

  const applyActionMutation = useMutation({
    mutationFn: async (data: {
      targetUserId: string;
      actionType: 'warn' | 'mute' | 'suspend' | 'ban';
      reason: string;
      durationDays?: number;
    }) => {
      const res = await apiClient.post<{ success: boolean; data: any }>('/moderation/actions', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'audit-logs'] });
    },
  });

  const submitAppealMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      const res = await apiClient.post<{ success: boolean; data: any }>('/appeals', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'appeals'] });
    },
  });

  const resolveAppealMutation = useMutation({
    mutationFn: async (data: { appealId: string; status: 'approved' | 'rejected' }) => {
      const res = await apiClient.post<{ success: boolean; data: any }>(
        `/appeals/${data.appealId}/resolve`,
        { status: data.status }
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation', 'appeals'] });
    },
  });

  return {
    useReportsQuery,
    useAppealsQuery,
    useAuditLogsQuery,
    submitReportMutation,
    assignReportMutation,
    resolveReportMutation,
    applyActionMutation,
    submitAppealMutation,
    resolveAppealMutation,
  };
}
