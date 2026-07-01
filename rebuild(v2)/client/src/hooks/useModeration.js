import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useModeration() {
  const queryClient = useQueryClient();

  // --- Queries ---

  const useReportsQuery = () =>
    useQuery({
      queryKey: ["moderation", "reports"],
      queryFn: async () => {
        const res = await apiClient.get("/reports");
        return res.data.data;
      },
    });

  const useAppealsQuery = () =>
    useQuery({
      queryKey: ["moderation", "appeals"],
      queryFn: async () => {
        const res = await apiClient.get("/appeals");
        return res.data.data;
      },
    });

  const useAuditLogsQuery = () =>
    useQuery({
      queryKey: ["moderation", "audit-logs"],
      queryFn: async () => {
        const res = await apiClient.get("/audit-logs");
        return res.data.data;
      },
    });

  // --- Mutations ---

  const submitReportMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/reports", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });

  const assignReportMutation = useMutation({
    mutationFn: async (reportId) => {
      const res = await apiClient.post(`/reports/${reportId}/assign`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });

  const resolveReportMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post(`/reports/${data.reportId}/resolve`, {
        status: data.status,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });

  const applyActionMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/moderation/actions", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "audit-logs"] });
    },
  });

  const submitAppealMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/appeals", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "appeals"] });
    },
  });

  const resolveAppealMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post(`/appeals/${data.appealId}/resolve`, {
        status: data.status,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "appeals"] });
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
