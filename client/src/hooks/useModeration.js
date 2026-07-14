import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

// --- Standalone Queries ---

export const useReportsQuery = () =>
  useQuery({
    queryKey: ["moderation", "reports"],
    queryFn: async () => {
      const res = await apiClient.get("/reports");
      return res.data.data;
    },
  });

export const useAppealsQuery = () =>
  useQuery({
    queryKey: ["moderation", "appeals"],
    queryFn: async () => {
      const res = await apiClient.get("/appeals");
      return res.data.data;
    },
  });

export const useAuditLogsQuery = () =>
  useQuery({
    queryKey: ["moderation", "audit-logs"],
    queryFn: async () => {
      const res = await apiClient.get("/audit-logs");
      return res.data.data;
    },
  });

// --- Standalone Mutations ---

export const useSubmitReportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/reports", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });
};

export const useAssignReportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reportId) => {
      const res = await apiClient.post(`/reports/${reportId}/assign`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "reports"] });
    },
  });
};

export const useResolveReportMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
};

export const useApplyActionMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/moderation/actions", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "audit-logs"] });
    },
  });
};

export const useSubmitAppealMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.post("/appeals", data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["moderation", "appeals"] });
    },
  });
};

export const useResolveAppealMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
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
};

// --- Backward Compatible Wrapper Hook ---

export function useModeration() {
  return {
    useReportsQuery,
    useAppealsQuery,
    useAuditLogsQuery,
    submitReportMutation: useSubmitReportMutation(),
    assignReportMutation: useAssignReportMutation(),
    resolveReportMutation: useResolveReportMutation(),
    applyActionMutation: useApplyActionMutation(),
    submitAppealMutation: useSubmitAppealMutation(),
    resolveAppealMutation: useResolveAppealMutation(),
  };
}
