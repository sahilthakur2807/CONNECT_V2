import { useState } from "react";
import {
  Shield,
  Search,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MoreVertical,
  UserX,
  ExternalLink,
  Activity,
  X,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { useModeration } from "@/hooks/useModeration";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ModeratorDashboard() {
  const [reportSearch, setReportSearch] = useState("");
  const {
    useReportsQuery,
    resolveReportMutation,
    applyActionMutation,
    assignReportMutation,
  } = useModeration();
  const { data: reports = [], isLoading } = useReportsQuery();

  // Suspend/Enforcement Modal States
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendUserId, setSuspendUserId] = useState("");
  const [suspendUsername, setSuspendUsername] = useState("");
  const [enforceType, setEnforceType] = useState("mute");
  const [enforceReason, setEnforceReason] = useState(
    "Harassment / Civility Violation",
  );
  const [enforceDays, setEnforceDays] = useState(3);

  // Subscribe to real-time moderation events (report created/assigned/resolved)
  useSocketEvents();

  const handleResolveReport = async (reportId, status) => {
    try {
      await resolveReportMutation.mutateAsync({ reportId, status });
      toast.success(`Case marked as ${status}`);
    } catch (e) {
      toast.error(e.message || "Failed to update case");
    }
  };

  const handleAssignReport = async (reportId) => {
    try {
      await assignReportMutation.mutateAsync(reportId);
      toast.success("Case assigned to you");
    } catch (e) {
      toast.error(e.message || "Failed to assign case");
    }
  };

  const openSuspendModal = (userId, username) => {
    setSuspendUserId(userId);
    setSuspendUsername(username);
    setSuspendOpen(true);
  };

  const handleApplyEnforcement = async () => {
    if (!suspendUserId || !enforceReason.trim()) {
      toast.error("Please enter a valid reason.");
      return;
    }
    try {
      await applyActionMutation.mutateAsync({
        targetUserId: suspendUserId,
        actionType: enforceType,
        reason: enforceReason,
        durationDays: enforceType !== "warn" ? enforceDays : undefined,
      });
      setSuspendOpen(false);
      setEnforceReason("Harassment / Civility Violation");
      toast.success(`Enforcement action (${enforceType}) applied successfully`);
    } catch (e) {
      toast.error(e.message || "Failed to apply enforcement");
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      reportSearch === "" ||
      r.reason.toLowerCase().includes(reportSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(reportSearch.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Loading cases...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto font-sans">
     <h1>
      This option will be added soon
     </h1>
    </div>
  );
}
export default ModeratorDashboard;
