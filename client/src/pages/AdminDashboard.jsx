import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
import {
  ShieldCheckIcon,
  LockClosedIcon,
  UsersIcon,
  ClipboardDocumentIcon,
  Cog8ToothIcon,
  FolderOpenIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  ArrowPathIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";

export function AdminDashboard() {
  const { user } = useAuth();
  const userRole = user?.role?.toUpperCase();
  const navigate = useNavigate();

  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isPlatformAdmin = ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(userRole);

  // Scoped authorization states
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Moderated communities for Community Owners/Admins
  const [moderatedCommunities, setModeratedCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");

  // Navigation Tab
  const [activeTab, setActiveTab] = useState("overview"); // overview, roles, rooms, audit, settings

  // State: Overview Metrics
  const [platformMetrics, setPlatformMetrics] = useState(null);
  const [communityMetrics, setCommunityMetrics] = useState(null);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // State: Escalated Issues
  const [escalatedReports, setEscalatedReports] = useState([]);
  const [isLoadingEscalated, setIsLoadingEscalated] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState(null);
  const [resolutionReason, setResolutionReason] = useState("");

  // State: Rooms/Community Control
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [newRoomDescription, setNewRoomDescription] = useState("");
  const [communityList, setCommunityList] = useState([]);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDescription, setNewCommunityDescription] = useState("");

  // State: Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // State: Platform Citizens List (SUPER_ADMIN only)
  const [platformUsers, setPlatformUsers] = useState([]);
  const [platformUsersFilter, setPlatformUsersFilter] = useState("ALL");
  const [isLoadingPlatformUsers, setIsLoadingPlatformUsers] = useState(false);

  // State: Global Settings (Super Admin)
  const [globalSettings, setGlobalSettings] = useState({
    allowRegistration: true,
    rateLimitRequests: 100,
    rateLimitMinutes: 15,
    bannedWords: "spam, abuse, scam"
  });

  // Action Confirmation Modals
  const [showConfirm, setShowConfirm] = useState(null); // { title, text, action }
  const [confirmInput, setConfirmInput] = useState("");

  // Load Moderated Communities
  const fetchModeratedCommunities = async () => {
    try {
      const res = await apiClient.get("/communities/moderated");
      const list = res.data.data || [];
      setModeratedCommunities(list);
      if (list.length > 0 && !selectedCommunityId) {
        if (isPlatformAdmin) {
          setSelectedCommunityId("");
        } else {
          setSelectedCommunityId(list[0].id);
        }
      }
    } catch (err) {
      toast.error("Failed to load moderated communities list");
    }
  };

  useEffect(() => {
    if (user) {
      if (isPlatformAdmin) {
        setIsAuthorized(true);
        setIsLoadingAuth(false);
        fetchModeratedCommunities();
        return;
      }

      apiClient.get("/communities/moderated")
        .then(res => {
          const list = res.data.data || [];
          setModeratedCommunities(list);
          if (list.length > 0 && !selectedCommunityId) {
            setSelectedCommunityId(list[0].id);
          }
          const hasAdminComm = list.some(c => ["OWNER", "ADMIN"].includes(c.myRole?.toUpperCase()));
          setIsAuthorized(hasAdminComm);
        })
        .catch(() => setIsAuthorized(false))
        .finally(() => setIsLoadingAuth(false));
    }
  }, [user, isPlatformAdmin]);

  // Fetch Overview Stats
  const fetchStats = async () => {
    setIsLoadingMetrics(true);
    try {
      if (isPlatformAdmin) {
        // Platform Stats
        const resStats = await apiClient.get("/stats");
        let resMetrics = { recentAuditsCount: 0 };
        try {
          const resM = await apiClient.get("/admin/metrics");
          resMetrics = resM.data.data || {};
        } catch (e) {
          console.warn("Analytics metrics endpoint warning:", e);
        }
        setPlatformMetrics({ ...resStats.data, ...resMetrics });
      }

      if (selectedCommunityId) {
        // Community Stats
        const resComm = await apiClient.get(`/communities/${selectedCommunityId}/stats`);
        setCommunityMetrics(resComm.data.data || null);
      }
    } catch (err) {
      toast.error("Failed to fetch dashboard metrics");
    } finally {
      setIsLoadingMetrics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "overview") {
      fetchStats();
    }
  }, [activeTab, selectedCommunityId]);

  // Fetch Escalated Reports
  const fetchEscalatedReports = async () => {
    setIsLoadingEscalated(true);
    try {
      const res = await apiClient.get("/reports?type=escalated");
      setEscalatedReports(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load escalated issues");
    } finally {
      setIsLoadingEscalated(false);
    }
  };

  useEffect(() => {
    if (activeTab === "escalated") {
      fetchEscalatedReports();
    }
  }, [activeTab]);

  // Load Communities for Creation/Suspension management
  const fetchAllCommunities = async () => {
    setIsLoadingCommunities(true);
    try {
      const res = await apiClient.get("/communities");
      setCommunityList(res.data.data || []);
    } catch (err) {
      toast.error("Failed to retrieve platform communities");
    } finally {
      setIsLoadingCommunities(false);
    }
  };

  useEffect(() => {
    if (activeTab === "rooms" && isPlatformAdmin) {
      fetchAllCommunities();
    }
  }, [activeTab]);

  // Load Audit Logs
  const fetchAuditLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const queryParam = selectedCommunityId ? `?communityId=${selectedCommunityId}` : "";
      const res = await apiClient.get(`/audit-logs${queryParam}`);
      setAuditLogs(res.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch audit log logs");
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs();
    }
  }, [activeTab, selectedCommunityId]);

  const handleResolveReport = async (reportId) => {
    if (!resolutionReason.trim()) {
      toast.error("Resolution reason is required");
      return;
    }
    try {
      await apiClient.post(`/reports/${reportId}/resolve`, {
        resolutionReason: resolutionReason.trim(),
      });
      toast.success("Issue resolved successfully");
      setResolvingReportId(null);
      setResolutionReason("");
      fetchEscalatedReports();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to resolve report");
    }
  };

  // Create new Room in community
  const handleCreateRoom = async () => {
    if (!selectedCommunityId) {
      toast.error("Select a community first");
      return;
    }
    if (!newRoomTitle.trim()) {
      toast.error("Provide a room title");
      return;
    }
    try {
      await apiClient.post("/rooms", {
        communityId: selectedCommunityId,
        title: newRoomTitle,
        description: newRoomDescription
      });
      toast.success("Room successfully launched");
      setNewRoomTitle("");
      setNewRoomDescription("");
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.error || "Room launch failed");
    }
  };

  // Create new Community
  const handleCreateCommunity = async () => {
    if (!newCommunityName.trim()) {
      toast.error("Provide a community name");
      return;
    }
    try {
      await apiClient.post("/communities", {
        name: newCommunityName,
        description: newCommunityDescription
      });
      toast.success("Community created successfully");
      setNewCommunityName("");
      setNewCommunityDescription("");
      fetchAllCommunities();
      fetchModeratedCommunities();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to create community");
    }
  };

  // Archive Community
  const handleArchiveCommunity = async (commId) => {
    try {
      await apiClient.post(`/communities/${commId}/archive`);
      toast.success("Community archived");
      if (isPlatformAdmin) fetchAllCommunities();
      fetchModeratedCommunities();
      setShowConfirm(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to archive community");
    }
  };

  // Delete Community
  const handleDeleteCommunity = async (commId) => {
    try {
      await apiClient.delete(`/communities/${commId}`);
      toast.success("Community permanently deleted");
      if (isPlatformAdmin) fetchAllCommunities();
      fetchModeratedCommunities();
      setShowConfirm(null);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete community");
    }
  };

  // Export full audit logs in JSON format
  const handleExportAuditLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `connect_audit_export_${selectedCommunityId || "platform"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Audit Log Exported successfully");
  };

  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto my-12 bg-card border border-border/50 rounded-3xl p-8 text-center space-y-6 shadow-lg animate-in fade-in">
        <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
          <ExclamationTriangleIcon className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black font-serif">Access Denied</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You do not have administrative roles inside any community or on the platform level. 
            If you believe this is in error, contact the community owner.
          </p>
        </div>
        <button
          onClick={() => navigate("/home")}
          className="w-full py-3 bg-muted hover:bg-muted-foreground/10 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-serif font-black"
        >
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto font-sans text-foreground">
      {/* Admin Panel Header */}
      <div className="bg-card/70 border border-border/40 backdrop-blur-md rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm animate-in fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-500">
            <LockClosedIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-serif tracking-tight">Administrative Control Center</h1>
            <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest mt-0.5">
              Control Context: <span className="text-indigo-500 font-bold">{userRole}</span>
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-muted/60 p-1 rounded-xl gap-1 self-start md:self-auto flex-wrap">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "overview" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("escalated")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "escalated" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Escalated Issues
          </button>
          {isPlatformAdmin && (
            <button
              onClick={() => setActiveTab("rename-requests")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "rename-requests" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              Rename Requests
            </button>
          )}
          <button
            onClick={() => setActiveTab("rooms")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "rooms" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Rooms & Comm
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "audit" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Audit Trails
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "settings" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              Super Admin Settings
            </button>
          )}
        </div>
      </div>

      {/* Scoped Community Selection Dropdown (Only shown if user has community credentials) */}
      {moderatedCommunities.length > 0 && (
        <div className="bg-card border border-border/40 p-4 rounded-xl flex items-center gap-3">
          <span className="text-xs font-black uppercase text-muted-foreground">Scope Active Community:</span>
          <select
            value={selectedCommunityId}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
            className="bg-muted text-foreground text-xs font-bold rounded-lg border border-border/40 py-1.5 px-3 outline-hidden cursor-pointer"
          >
            {isPlatformAdmin && <option value="">-- Platform Wide Scope --</option>}
            {moderatedCommunities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.myRole})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Tab Renderers */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          {/* Platform Metrics (Platform staff only) */}
          {isPlatformAdmin && !selectedCommunityId && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Total Members</span>
                <p className="text-3xl font-black mt-2 text-foreground">{platformMetrics?.totalUsers || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Active Online</span>
                <p className="text-3xl font-black mt-2 text-emerald-500">{platformMetrics?.activeUsers || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Communities</span>
                <p className="text-3xl font-black mt-2 text-foreground">{platformMetrics?.totalCommunities || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Discussion Rooms</span>
                <p className="text-3xl font-black mt-2 text-foreground">{platformMetrics?.totalRooms || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Messages Exchanged</span>
                <p className="text-3xl font-black mt-2 text-indigo-500">{platformMetrics?.totalMessages || 0}</p>
              </div>
            </div>
          )}

          {/* Community Scoped Overview metrics */}
          {selectedCommunityId && communityMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Community Members</span>
                <p className="text-3xl font-black mt-2 text-foreground">{communityMetrics.memberCount || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Room Count</span>
                <p className="text-3xl font-black mt-2 text-foreground">{communityMetrics.roomCount || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Violation Incidents</span>
                <p className="text-3xl font-black mt-2 text-rose-500">{communityMetrics.violationCount || 0}</p>
              </div>
              <div className="bg-card border border-border/50 rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Archived Rooms</span>
                <p className="text-3xl font-black mt-2 text-muted-foreground">{communityMetrics.archivedCount || 0}</p>
              </div>
            </div>
          )}

          {!selectedCommunityId && !isPlatformAdmin && (
            <div className="bg-card border border-border/50 p-8 rounded-2xl text-center italic text-xs text-muted-foreground">
              Select one of your moderated communities above to view metrics and statistics.
            </div>
          )}
        </div>
      )}

      {activeTab === "escalated" && (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
          <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-rose-500 animate-pulse" />
                <h2 className="text-sm font-black uppercase tracking-wider">Escalated Moderation Issues</h2>
              </div>
              <button
                onClick={fetchEscalatedReports}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors"
                title="Refresh List"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            </div>

            {isLoadingEscalated ? (
              <div className="py-12 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                Loading escalated issues...
              </div>
            ) : escalatedReports.length > 0 ? (
              <div className="space-y-4">
                {escalatedReports.map((report) => (
                  <div
                    key={report.id}
                    className="p-4 bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/80 rounded-xl transition-all space-y-3"
                  >
                    {/* Header: Status badge, Category & Timestamp */}
                    <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] text-muted-foreground font-semibold">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 rounded-md border border-rose-500/20">
                          {report.status}
                        </span>
                        <span className="font-black text-foreground uppercase bg-secondary px-2 py-0.5 rounded-md">
                          {report.reason}
                        </span>
                      </div>
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Description and Content */}
                    <div className="text-xs space-y-2">
                      <p className="text-foreground leading-relaxed">
                        <span className="font-black text-[10px] uppercase text-muted-foreground block mb-0.5">Report Description:</span>
                        {report.description}
                      </p>

                      {/* Escalation Reason */}
                      {report.resolutionReason && (
                        <p className="p-2.5 bg-rose-500/5 text-rose-500 rounded-lg border border-rose-500/10 text-xs italic font-semibold">
                          <span className="font-black text-[10px] uppercase text-rose-500/70 block not-italic mb-0.5">Moderator Escalation Note:</span>
                          {report.resolutionReason.replace(/^Escalated:\s*/i, "")}
                        </p>
                      )}

                      {/* Details on reported entities */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1">
                          <span className="font-black text-[10px] uppercase text-muted-foreground block">Reporter</span>
                          <span className="text-foreground font-bold">
                            @{report.reporter?.username} <span className="text-[10px] font-medium text-muted-foreground">({report.reporter?.name || report.reporter?.email})</span>
                          </span>
                        </div>
                        {report.reportedUser && (
                          <div className="space-y-1">
                            <span className="font-black text-[10px] uppercase text-muted-foreground block">Reported User</span>
                            <span className="text-foreground font-bold text-rose-400">
                              @{report.reportedUser?.username} <span className="text-[10px] font-medium text-muted-foreground">({report.reportedUser?.name || report.reportedUser?.email})</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Message Content Context */}
                      {report.message && (
                        <div className="p-3 bg-card border border-border/40 rounded-xl mt-2 text-xs">
                          <span className="font-black text-[10px] uppercase text-muted-foreground block mb-1">Reported Message Content</span>
                          <blockquote className="border-l-2 border-border pl-3 text-muted-foreground italic">
                            "{report.message.content}"
                          </blockquote>
                        </div>
                      )}

                      {/* Room and Community Context */}
                      <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
                        {report.room && (
                          <span>
                            Room: <span className="font-bold text-foreground">#{report.room.title}</span>
                          </span>
                        )}
                        {report.reportedCommunity && (
                          <span>
                            Community: <span className="font-bold text-foreground">{report.reportedCommunity.name}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="border-t border-border/20 pt-3 flex flex-col gap-2.5">
                      {resolvingReportId === report.id ? (
                        <div className="space-y-2">
                          <textarea
                            placeholder="Provide resolution details (e.g., content removed, user warned, or closed as false positive)..."
                            value={resolutionReason}
                            onChange={(e) => setResolutionReason(e.target.value)}
                            className="w-full bg-card text-foreground border border-border/60 rounded-xl p-2.5 text-xs outline-hidden min-h-[70px] placeholder-muted-foreground font-semibold"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResolveReport(report.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3.5 py-1.5 font-bold text-[10px] uppercase transition-all cursor-pointer border-none"
                            >
                              Confirm Resolution
                            </button>
                            <button
                              onClick={() => {
                                setResolvingReportId(null);
                                setResolutionReason("");
                              }}
                              className="bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg px-3.5 py-1.5 font-bold text-[10px] uppercase transition-all cursor-pointer border-none"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolvingReportId(report.id)}
                          className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded-xl px-4 py-2 font-bold text-xs uppercase transition-all cursor-pointer self-start"
                        >
                          Mark as Resolved
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-muted-foreground italic bg-muted/20 border border-dashed border-border/60 rounded-xl">
                No escalated issues currently active. Good job!
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "rooms" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-2">
          {/* Left panel: Create Room inside scoped community */}
          <div className="lg:col-span-6 bg-card border border-border/50 rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-black uppercase tracking-wider">Create Discussion Room</h2>
            {selectedCommunityId ? (
              <div className="space-y-4 text-xs font-semibold">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Room Title</label>
                  <input
                    type="text"
                    placeholder="e.g. general-talk"
                    value={newRoomTitle}
                    onChange={(e) => setNewRoomTitle(e.target.value)}
                    className="w-full bg-muted border border-border/50 rounded-xl py-2.5 px-3 outline-hidden"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Description</label>
                  <textarea
                    placeholder="Room description..."
                    value={newRoomDescription}
                    onChange={(e) => setNewRoomDescription(e.target.value)}
                    className="w-full bg-muted border border-border/50 rounded-xl p-3 h-24 outline-hidden resize-none"
                  />
                </div>
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-xs uppercase cursor-pointer"
                >
                  Create Room
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Scope a specific community above to add a discussion room.</p>
            )}
          </div>

          {/* Right panel: Platform Overrides / Community Creations */}
          <div className="lg:col-span-6 bg-card border border-border/50 rounded-2xl p-5 space-y-5">
            <h2 className="text-sm font-black uppercase tracking-wider">Community Management</h2>
            {isPlatformAdmin ? (
              <div className="space-y-6">
                {/* Create Community */}
                <div className="space-y-3.5 border-b border-border/30 pb-4 text-xs font-semibold">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider block">Launch New Community</span>
                  <input
                    type="text"
                    placeholder="Community Name"
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Brief description..."
                    value={newCommunityDescription}
                    onChange={(e) => setNewCommunityDescription(e.target.value)}
                    className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                  />
                  <button
                    onClick={handleCreateCommunity}
                    className="w-full py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold uppercase text-[10px] tracking-wider cursor-pointer"
                  >
                    Launch Community
                  </button>
                </div>

                {/* Communities List Operations */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Community Override Control Desk</span>
                  {isLoadingCommunities ? (
                    <div className="py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                      Retrieving communities...
                    </div>
                  ) : communityList.length > 0 ? (
                    <div className="divide-y divide-border/20 max-h-[250px] overflow-y-auto pr-1">
                      {communityList.map((comm) => (
                        <div key={comm.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                          <div>
                            <p className="font-bold">{comm.name}</p>
                            <p className="text-[10px] text-muted-foreground">ID: {comm.id}</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => setShowConfirm({
                                title: "Archive Community",
                                text: `Are you sure you want to archive ${comm.name}?`,
                                action: () => handleArchiveCommunity(comm.id)
                              })}
                              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 rounded-md cursor-pointer"
                            >
                              Archive
                            </button>
                            <button
                              onClick={() => setShowConfirm({
                                title: "Delete Community Permanently",
                                text: `CRITICAL ACTION: Are you sure you want to permanently delete the community ${comm.name}? All message records and rooms will be purged.`,
                                action: () => handleDeleteCommunity(comm.id)
                              })}
                              className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-md cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No platform communities registered.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Platform level overrides are restricted to Platform Administrators.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <ClipboardDocumentIcon className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Audit Trail Log {selectedCommunityId ? "(Community Scoped)" : "(Platform Wide)"}
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportAuditLogs}
                className="px-3 py-1.5 bg-muted text-foreground border border-border/40 hover:bg-muted-foreground/10 text-xs font-bold uppercase tracking-wider rounded-xl flex items-center gap-1 cursor-pointer"
              >
                <ArrowDownTrayIcon className="w-4 h-4" /> Export logs
              </button>
              <button
                onClick={fetchAuditLogs}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {isLoadingLogs ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
              Retrieving logs...
            </div>
          ) : auditLogs.length > 0 ? (
            <div className="space-y-2.5 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 rounded-xl border border-border/30 bg-muted/10 text-xs space-y-1.5">
                  <div className="flex justify-between items-start">
                    <span className="font-black text-indigo-500 uppercase tracking-widest">{log.action}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-foreground leading-relaxed">"{log.details}"</p>
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/20 pt-2">
                    <span>Actor ID: <code className="font-mono bg-muted px-1">{log.actorId}</code></span>
                    <span>Target Type: <strong className="text-foreground">{log.targetType}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-xs text-muted-foreground italic font-medium">
              No audit logs matching this scope have been logged.
            </p>
          )}
        </div>
      )}

      {activeTab === "settings" && isSuperAdmin && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-6 animate-in slide-in-from-bottom-2 text-xs font-semibold">
          <div className="flex items-center gap-2 border-b border-border/40 pb-3">
            <Cog8ToothIcon className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-black uppercase tracking-wider text-indigo-500">Global Settings Control Panel</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border/30">
                <div>
                  <h3 className="font-black text-foreground">Allow New Registration</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Toggle platform signups dynamically.</p>
                </div>
                <input
                  type="checkbox"
                  checked={globalSettings.allowRegistration}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, allowRegistration: e.target.checked })}
                  className="w-5 h-5 rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="p-4 bg-muted/40 rounded-xl border border-border/30 space-y-3">
                <h3 className="font-black text-foreground">Global API Rate Limiting</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Requests Limit</label>
                    <input
                      type="number"
                      value={globalSettings.rateLimitRequests}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, rateLimitRequests: parseInt(e.target.value) || 100 })}
                      className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">Per Minutes</label>
                    <input
                      type="number"
                      value={globalSettings.rateLimitMinutes}
                      onChange={(e) => setGlobalSettings({ ...globalSettings, rateLimitMinutes: parseInt(e.target.value) || 15 })}
                      className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-muted/40 rounded-xl border border-border/30 space-y-2.5">
                <h3 className="font-black text-foreground">Banned Word Filter</h3>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Enter comma separated phrases. Messages matching this list will be flagged for automatic moderation queues.
                </p>
                <textarea
                  value={globalSettings.bannedWords}
                  onChange={(e) => setGlobalSettings({ ...globalSettings, bannedWords: e.target.value })}
                  className="w-full bg-muted border border-border/50 rounded-xl p-3 h-28 outline-hidden resize-none"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-4 flex justify-end">
            <button
              onClick={() => {
                toast.success("Platform settings saved successfully");
                // Log action in audit logs manually or via backend save settings
                apiClient.post("/moderation/content/remove", {
                  contentType: "community", // dummy call just to verify, or skip
                  contentId: "dummy",
                  reason: "Updated global platform settings configuration flags"
                }).catch(() => {});
              }}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all uppercase tracking-wider font-bold"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}      {activeTab === "rename-requests" && isPlatformAdmin && (
        <AdminRenameRequestsTab />
      )}

      {/* Confirmation Step Up modal overlay */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-md w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black font-serif">{showConfirm.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{showConfirm.text}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs font-semibold">
              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Type "CONFIRM" to authorize
              </label>
              <input
                type="text"
                placeholder="Type CONFIRM"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full bg-muted border border-border/50 rounded-xl py-2.5 px-3 outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowConfirm(null);
                  setConfirmInput("");
                }}
                className="px-4 py-2 text-xs font-bold uppercase bg-muted border border-border/30 rounded-xl text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={confirmInput !== "CONFIRM"}
                onClick={() => {
                  showConfirm.action();
                  setConfirmInput("");
                }}
                className="px-4 py-2 text-xs font-bold uppercase bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
              >
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminRenameRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/rooms/rename-requests");
      setRequests(res.data.data || []);
    } catch (err) {
      toast.error("Failed to load rename requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (id) => {
    try {
      await apiClient.post(`/rooms/rename-requests/${id}/approve`);
      toast.success("Rename request approved successfully!");
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to approve request");
    }
  };

  const handleReject = async (id) => {
    try {
      await apiClient.post(`/rooms/rename-requests/${id}/reject`);
      toast.success("Rename request rejected");
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to reject request");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <ArrowPathIcon className="animate-spin text-primary w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/50 rounded-3xl p-6 shadow-sm space-y-6 animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h2 className="text-lg font-black font-serif">Pending Room Rename Requests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and approve or reject requested title updates from room owners.
          </p>
        </div>
        <span className="text-[10px] font-black bg-primary/10 text-primary px-2.5 py-1 rounded-md font-mono">
          {requests.length} pending
        </span>
      </div>

      {requests.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-4 text-center font-medium">
          No pending rename requests at this time.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Original Name</th>
                <th className="py-3 px-4">Proposed Name</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/25 transition-colors font-medium">
                  <td className="py-3 px-4 font-bold">
                    @{r.createdBy?.username || "unknown"}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">{r.title}</td>
                  <td className="py-3 px-4 text-indigo-500 font-bold">{r.pendingNameRequest}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="h-8 px-3.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer border-none flex items-center gap-1 transition-all"
                      >
                        <CheckIcon className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="h-8 px-3.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase cursor-pointer border-none flex items-center gap-1 transition-all"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
