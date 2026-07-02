import { useState } from "react";
import {
  Settings,
  Users,
  BarChart2,
  Shield,
  Globe,
  Lock,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { StatCard } from "@/components/shared/StatCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAnalytics } from "@/hooks/useAnalytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

export function AdminDashboard() {
  // const { user: currentUser } = useAuth();
  // Dates for platform metrics query (last 30 days)
  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const { useAdminMetricsQuery, awardReputationMutation } = useAnalytics();
  const { data: metrics, isLoading } = useAdminMetricsQuery(
    thirtyDaysAgoStr,
    todayStr,
  );

  // Settings states simulated in localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("newsconnect_settings");
    return saved
      ? JSON.parse(saved)
      : {
          maintenance_mode: false,
          allow_registration: true,
          enable_websockets: true,
          rate_limit: 300,
          default_reputation: 10,
        };
  });

  // Reputation dialog states
  const [repUserId, setRepUserId] = useState("");
  const [repAmount, setRepAmount] = useState(5);
  const [repReason, setRepReason] = useState("Outstanding Contribution");

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem("newsconnect_settings", JSON.stringify(settings));
    toast.success("System settings saved and applied!");
  };

  const handleAwardReputation = async (e) => {
    e.preventDefault();
    if (!repUserId.trim()) {
      toast.error("Please enter a target User ID");
      return;
    }
    try {
      await awardReputationMutation.mutateAsync({
        targetUserId: repUserId,
        amount: repAmount,
        reason: repReason,
      });
      toast.success("Reputation points successfully awarded!");
      setRepUserId("");
    } catch (err) {
      toast.error(err.message || "Failed to award reputation");
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Loading metrics...
        </p>
      </div>
    );
  }

  // Formatting metrics data for Recharts BarChart
  const chartData = [
    { name: "Active (DAU)", count: metrics?.dau || 0 },
    { name: "Registrations", count: metrics?.registrations || 0 },
    { name: "Messages Volume", count: metrics?.messageVolume || 0 },
    { name: "Mod Actions", count: metrics?.moderationCount || 0 },
  ];

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto font-sans">
     <h1>
      This option will be added soon
     </h1>
    </div>
  );
}
export default AdminDashboard;
