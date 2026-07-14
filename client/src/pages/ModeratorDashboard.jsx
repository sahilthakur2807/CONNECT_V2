import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "@/store";
import { apiClient } from "@/services/apiClient";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  FunnelIcon,
  UserIcon,
  ScaleIcon,
  ChatBubbleBottomCenterTextIcon,
  TrashIcon,
  ArrowUpIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  EllipsisVerticalIcon
} from "@heroicons/react/24/outline";

export function ModeratorDashboard() {
  const { user } = useAppSelector((state) => state.auth);
  const userRole = user?.role?.toUpperCase();
  const navigate = useNavigate();

  // Scoped authorization states
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState("reports"); // reports, lookup, history, appeals

  // State for Reports
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState("open"); // open, assigned
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoadingReports, setIsLoadingReports] = useState(false);

  // State for User Lookup
  const [searchQuery, setSearchQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await apiClient.get(`/moderation/users/lookup?query=${encodeURIComponent(searchQuery)}&suggest=true`);
        setSuggestions(res.data.data || []);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // State for Action History
  const [actionHistory, setActionHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // State for Appeals
  const [appeals, setAppeals] = useState([]);
  const [isLoadingAppeals, setIsLoadingAppeals] = useState(false);
  const [selectedAppeal, setSelectedAppeal] = useState(null);

  // Scoped Communities (for filtering or actions)
  const [moderatedCommunities, setModeratedCommunities] = useState([]);
  const [ownedRooms, setOwnedRooms] = useState([]);
  const [selectedScope, setSelectedScope] = useState("all");

  // Modals for actions
  const [showModActionModal, setShowModActionModal] = useState(false);
  const [modActionTarget, setModActionTarget] = useState(null); // { userId, username, communityId }
  const [modActionForm, setModActionForm] = useState({
    type: "warn", // warn, mute, suspend, ban
    reason: "",
    durationDays: 1,
    permanent: false
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmCallback, setConfirmCallback] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [stepUpPassword, setStepUpPassword] = useState("");

  // Check roles permitted to see appeals (SUPER_ADMIN, PLATFORM_ADMIN, Community OWNER, Community ADMIN)
  const canSeeAppeals = ["SUPER_ADMIN", "PLATFORM_ADMIN", "ADMIN", "SUPERADMIN"].includes(userRole) || moderatedCommunities.some(c => ["OWNER", "ADMIN"].includes(c.myRole?.toUpperCase()));

  // Fetch Moderated Communities and Owned Rooms on mount and verify credentials
  useEffect(() => {
    if (user) {
      const isPlatformStaff = ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(userRole);
      
      const checkCredentials = async () => {
        try {
          // Fetch moderated communities
          const commRes = await apiClient.get("/communities/moderated");
          const commList = commRes.data.data || [];
          setModeratedCommunities(commList);

          // Fetch owned rooms
          const roomsRes = await apiClient.get(`/users/${user.id}/rooms-owned`);
          const roomsList = roomsRes.data.data || [];
          setOwnedRooms(roomsList);

          const hasAccess = isPlatformStaff || commList.length > 0 || roomsList.length > 0;
          setIsAuthorized(hasAccess);
        } catch (err) {
          console.error("Failed to load moderator credentials:", err);
          setIsAuthorized(isPlatformStaff);
        } finally {
          setIsLoadingAuth(false);
        }
      };

      checkCredentials();
    }
  }, [user, userRole]);

  // Fetch Reports
  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await apiClient.get(`/reports?type=${reportFilter}`);
      setReports(res.data.data || []);
    } catch (err) {
      toast.error("Failed to fetch reports");
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") {
      fetchReports();
    }
  }, [activeTab, reportFilter]);

  // Fetch Action History
  const fetchActionHistory = async () => {
    setIsLoadingHistory(true);
    try {
      // Get audit logs, filter to user's actions
      const res = await apiClient.get(`/audit-logs?limit=100`);
      // Filter in-memory to own logs
      const myLogs = (res.data.data || []).filter(log => log.actorId === user.id);
      setActionHistory(myLogs);
    } catch (err) {
      toast.error("Failed to retrieve action history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchActionHistory();
    }
  }, [activeTab]);

  // Fetch Appeals
  const fetchAppeals = async () => {
    setIsLoadingAppeals(true);
    try {
      const res = await apiClient.get("/appeals");
      setAppeals(res.data.data || []);
    } catch (err) {
      toast.error("Failed to retrieve appeals queue");
    } finally {
      setIsLoadingAppeals(false);
    }
  };

  useEffect(() => {
    if (activeTab === "appeals" && canSeeAppeals) {
      fetchAppeals();
    }
  }, [activeTab, canSeeAppeals]);

  // Real-time socket updates for reports
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleReportCreated = (newReport) => {
      if (activeTab === "reports" && reportFilter === "open") {
        setReports(prev => [newReport.data, ...prev]);
        toast.info(`New report filed: ${newReport.data.reason}`);
      }
    };

    const handleReportAssigned = (updatedReport) => {
      if (activeTab === "reports") {
        setReports(prev => prev.map(r => r.id === updatedReport.data.id ? updatedReport.data : r));
      }
    };

    const handleReportResolved = (updatedReport) => {
      if (activeTab === "reports") {
        setReports(prev => prev.filter(r => r.id !== updatedReport.data.id));
        if (selectedReport?.id === updatedReport.data.id) {
          setSelectedReport(null);
        }
      }
    };

    const handleReportEscalated = (updatedReport) => {
      if (activeTab === "reports") {
        // Refresh report queue
        fetchReports();
      }
    };

    socket.on("report.created", handleReportCreated);
    socket.on("report.assigned", handleReportAssigned);
    socket.on("report.resolved", handleReportResolved);
    socket.on("report.escalated", handleReportEscalated);

    return () => {
      socket.off("report.created", handleReportCreated);
      socket.off("report.assigned", handleReportAssigned);
      socket.off("report.resolved", handleReportResolved);
      socket.off("report.escalated", handleReportEscalated);
    };
  }, [activeTab, reportFilter, selectedReport]);

  const filteredReports = reports.filter((report) => {
    if (selectedScope === "all") return true;
    if (selectedScope.startsWith("room_")) {
      const roomId = selectedScope.substring(5);
      return report.roomId === roomId;
    }
    if (selectedScope.startsWith("community_")) {
      const communityId = selectedScope.substring(10);
      return report.reportedCommunityId === communityId || report.room?.communityId === communityId;
    }
    return true;
  });

  const filteredActionHistory = actionHistory.filter((item) => {
    if (selectedScope === "all") return true;
    if (selectedScope.startsWith("room_")) {
      const roomId = selectedScope.substring(5);
      return item.targetId === roomId || item.details?.includes(roomId);
    }
    if (selectedScope.startsWith("community_")) {
      const communityId = selectedScope.substring(10);
      return item.communityId === communityId || item.details?.includes(communityId);
    }
    return true;
  });

  // Action: Assign report to self
  const handleAssignToSelf = async (reportId) => {
    try {
      const res = await apiClient.post(`/reports/${reportId}/assign`, { moderatorId: user.id });
      toast.success("Report assigned to you");
      setReports(prev => prev.map(r => r.id === reportId ? res.data.data : r));
      setSelectedReport(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "Assignment failed");
    }
  };

  // Action: Resolve Report
  const handleResolveReport = async (reportId, reason) => {
    if (!reason.trim()) {
      toast.error("Please enter a resolution reason");
      return;
    }
    try {
      await apiClient.post(`/reports/${reportId}/resolve`, { resolutionReason: reason });
      toast.success("Report resolved successfully");
      setReports(prev => prev.filter(r => r.id !== reportId));
      setSelectedReport(null);
      setShowConfirmation(false);
      setConfirmText("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Resolution failed");
    }
  };

  // Action: Escalate Report
  const handleEscalateReport = async (reportId, reason) => {
    if (!reason.trim()) {
      toast.error("Please provide a reason for escalation");
      return;
    }
    try {
      await apiClient.post(`/reports/${reportId}/escalate`, { reason });
      toast.success("Report escalated to platform staff");
      setReports(prev => prev.filter(r => r.id !== reportId));
      setSelectedReport(null);
      setShowConfirmation(false);
      setConfirmText("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Escalation failed");
    }
  };

  // Action: Resolve Appeal
  const handleResolveAppeal = async (appealId, status, resolution) => {
    if (!resolution.trim()) {
      toast.error("Please provide a resolution statement");
      return;
    }
    try {
      await apiClient.post(`/appeals/${appealId}/resolve`, { status, resolution });
      toast.success(`Appeal ${status} successfully`);
      setAppeals(prev => prev.filter(a => a.id !== appealId));
      setSelectedAppeal(null);
      setShowConfirmation(false);
      setConfirmText("");
    } catch (err) {
      toast.error(err.response?.data?.error || "Appeal resolution failed");
    }
  };

  // Action: Warn/Mute/Suspend/Ban User
  const handleExecuteModAction = async () => {
    const { type, reason, durationDays, permanent } = modActionForm;
    if (!reason.trim()) {
      toast.error("Please enter a reason for this enforcement");
      return;
    }

    const expiresAt = permanent ? null : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    try {
      await apiClient.post("/moderation/actions", {
        targetUserId: modActionTarget.userId,
        type,
        reason,
        expiresAt,
        communityId: modActionTarget.communityId || undefined,
        roomId: modActionTarget.roomId || undefined
      });
      toast.success(`User successfully ${type}ed`);
      setShowModActionModal(false);
      setModActionForm({ type: "warn", reason: "", durationDays: 1, permanent: false });
      // If we searched for this user, refresh their lookup card
      if (lookupResult && lookupResult.user.id === modActionTarget.userId) {
        handleUserLookup(lookupResult.user.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to enforce ${type}`);
    }
  };

  // Action: Delete Message
  const handleDeleteContent = async (contentType, contentId, reason) => {
    if (!reason.trim()) {
      toast.error("Please provide a deletion reason");
      return;
    }
    try {
      await apiClient.post("/moderation/content/remove", {
        contentType,
        contentId,
        reason
      });
      toast.success("Content successfully removed");
      setShowConfirmation(false);
      setConfirmText("");
      // Update selected report context if matching
      if (selectedReport && selectedReport.messageId === contentId) {
        setSelectedReport({ ...selectedReport, message: { ...selectedReport.message, deleted: true } });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "Content removal failed");
    }
  };

  // User Search Lookup
  const handleUserLookup = async (queryVal) => {
    const val = queryVal || searchQuery;
    if (!val.trim()) return;
    setIsSearchingUser(true);
    try {
      const res = await apiClient.get(`/moderation/users/lookup?query=${encodeURIComponent(val)}`);
      setLookupResult(res.data.data);
    } catch (err) {
      toast.error(err.response?.data?.error || "User lookup failed or unauthorized");
      setLookupResult(null);
    } finally {
      setIsSearchingUser(false);
    }
  };

  // Step-Up Confirmation Helper
  const triggerConfirmation = (title, placeholder, actionCallback) => {
    setConfirmText("");
    setConfirmCallback(() => (inputText) => actionCallback(inputText));
    setShowConfirmation(title);
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
          <ShieldExclamationIcon className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black font-serif">Access Denied</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You do not have the necessary moderation or administration credentials to access this control desk. 
            If you believe this is in error, contact your community owner.
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
      {/* Upper Glass Header */}
      <div className="bg-card/70 border border-border/40 backdrop-blur-md rounded-2xl p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-sm animate-in fade-in">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <ShieldExclamationIcon className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-serif tracking-tight">Moderator Control Desk</h1>
            <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest mt-0.5">
              Active Authorization: <span className="text-primary font-bold">{userRole}</span>
            </p>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-muted/60 p-1 rounded-xl gap-1 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "reports" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Report Queue
          </button>
          <button
            onClick={() => setActiveTab("lookup")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "lookup" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            User Lookup
          </button>
          {canSeeAppeals && (
            <button
              onClick={() => setActiveTab("appeals")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "appeals" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
            >
              Appeals
            </button>
          )}
          <button
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${activeTab === "history" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            My Activity
          </button>
      </div>
    </div>

    {/* Active Scope Selector */}
      {(moderatedCommunities.length > 0 || ownedRooms.length > 0) && (
        <div className="bg-card border border-border/40 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
          <span className="text-xs font-black uppercase text-muted-foreground">Scope Moderation View:</span>
          <select
            value={selectedScope}
            onChange={(e) => {
              setSelectedScope(e.target.value);
              setSelectedReport(null);
            }}
            className="bg-muted text-foreground text-xs font-bold rounded-lg border border-border/40 py-1.5 px-3 outline-hidden cursor-pointer"
          >
            <option value="all">-- All Authorized Scopes --</option>
            {moderatedCommunities.map((c) => (
              <option key={c.id} value={`community_${c.id}`}>
                Community: {c.name} ({c.myRole})
              </option>
            ))}
            {ownedRooms.map((r) => (
              <option key={r.id} value={`room_${r.id}`}>
                Discussion Room: {r.title} (Owner)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Panel Sections */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-2">
          {/* Left: Queue List */}
          <div className="lg:col-span-5 bg-card border border-border/50 rounded-2xl p-5 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-black uppercase tracking-wider">Reports Queue</h2>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={reportFilter}
                  onChange={(e) => {
                    setReportFilter(e.target.value);
                    setSelectedReport(null);
                  }}
                  className="bg-muted text-foreground text-xs font-bold rounded-lg border border-border/40 py-1 px-2.5 outline-hidden cursor-pointer"
                >
                  <option value="open">Open Reports</option>
                  <option value="assigned">My Assignments</option>
                </select>
                <button
                  onClick={fetchReports}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
                >
                  <ArrowPathIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isLoadingReports ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading queue...</p>
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    onClick={() => setSelectedReport(report)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedReport?.id === report.id ? "bg-primary/[0.06] border-primary/45 shadow-xs" : "border-border/30 hover:bg-muted/40"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black uppercase tracking-wider text-primary">{report.reason}</span>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{report.description}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Reporter: <strong className="text-foreground">@{report.reporter?.username}</strong></span>
                      <span>Target: <strong className="text-foreground">@{report.reportedUser?.username || "N/A"}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center py-12 text-center">
                <ShieldCheckIcon className="w-12 h-12 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Queue Cleared</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No reports matching this filter require review.</p>
              </div>
            )}
          </div>

          {/* Right: Inspector Detail View */}
          <div className="lg:col-span-7 bg-card border border-border/50 rounded-2xl p-5 flex flex-col min-h-[500px]">
            {selectedReport ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-start justify-between border-b border-border/50 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          {selectedReport.severity}
                        </span>
                        {selectedReport.assignedId && (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                            Assigned to @{selectedReport.assigned?.username || "mod"}
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-black font-serif mt-1">{selectedReport.reason}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Report ID: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">{selectedReport.id}</code>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedReport(null)}
                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Context Cards */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-muted/40 rounded-xl border border-border/30">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Reporter</span>
                      <p className="text-xs font-black">@{selectedReport.reporter?.username}</p>
                      <span className="text-[10px] text-muted-foreground">ID: {selectedReport.reporterId}</span>
                    </div>
                    <div className="p-3.5 bg-muted/40 rounded-xl border border-border/30">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Reported Target User</span>
                      <p className="text-xs font-black">@{selectedReport.reportedUser?.username || "N/A"}</p>
                      <span className="text-[10px] text-muted-foreground">ID: {selectedReport.reportedUserId || "N/A"}</span>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Report Statement</span>
                    <div className="bg-muted/50 p-4 rounded-xl text-xs border border-border/30 whitespace-pre-wrap leading-relaxed text-foreground">
                      {selectedReport.description}
                    </div>
                  </div>

                  {/* Content Meta */}
                  {(selectedReport.messageId || selectedReport.roomId || selectedReport.reportedCommunityId) && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Associated Content Context</span>
                      <div className="bg-card p-4 rounded-xl border border-border/50 space-y-3">
                        {selectedReport.reportedCommunityId && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Reported Community:</span>
                            <span className="font-bold">{selectedReport.reportedCommunity?.name || selectedReport.reportedCommunityId}</span>
                          </div>
                        )}
                        {selectedReport.roomId && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Reported Room:</span>
                            <span className="font-bold">{selectedReport.room?.title || selectedReport.roomId}</span>
                          </div>
                        )}
                        {selectedReport.messageId && (
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Reported Message:</span>
                              {selectedReport.message?.deleted ? (
                                <span className="text-rose-500 font-mono text-[10px] uppercase font-bold">Deleted</span>
                              ) : (
                                <button
                                  onClick={() => triggerConfirmation(
                                    "Delete Message Content",
                                    "Provide deletion reason...",
                                    (reason) => handleDeleteContent("message", selectedReport.messageId, reason)
                                  )}
                                  className="text-rose-500 hover:underline flex items-center gap-1 font-bold text-[11px] cursor-pointer"
                                >
                                  <TrashIcon className="w-3.5 h-3.5" /> Remove Content
                                </button>
                              )}
                            </div>
                            {!selectedReport.message?.deleted && (
                              <div className="bg-muted p-3 rounded-lg border border-border/20 text-xs italic mt-1">
                                "{selectedReport.message?.content}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Operations Toolbar */}
                <div className="border-t border-border/50 pt-4 flex flex-wrap gap-2.5 mt-6 justify-end">
                  {/* Action: Claim Assignment */}
                  {selectedReport.status === "pending" && (
                    <button
                      onClick={() => handleAssignToSelf(selectedReport.id)}
                      className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-muted hover:bg-muted-foreground/10 border border-border/40 text-foreground rounded-xl transition-all cursor-pointer"
                    >
                      Assign to Me
                    </button>
                  )}

                  {/* Actions visible only when assigned to self or Platform Mod/Admin */}
                  {(selectedReport.assignedId === user.id || ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(userRole)) && (
                    <>
                      <button
                        onClick={() => {
                          setModActionTarget({
                            userId: selectedReport.reportedUserId,
                            username: selectedReport.reportedUser?.username || "user",
                            communityId: selectedReport.reportedCommunityId || selectedReport.room?.communityId || undefined,
                            roomId: selectedReport.roomId || undefined
                          });
                          setShowModActionModal(true);
                        }}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
                      >
                        Restrict User
                      </button>

                      {/* Escalate */}
                      <button
                        onClick={() => triggerConfirmation(
                          "Escalate Report to Platform Staff",
                          "Reason for escalation...",
                          (reason) => handleEscalateReport(selectedReport.id, reason)
                        )}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-amber-500 text-white rounded-xl hover:bg-amber-600 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ArrowUpIcon className="w-3.5 h-3.5" /> Escalate
                      </button>

                      {/* Dismiss / Resolve */}
                      <button
                        onClick={() => triggerConfirmation(
                          "Resolve and Close Report",
                          "Describe resolution rationale...",
                          (reason) => handleResolveReport(selectedReport.id, reason)
                        )}
                        className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <CheckIcon className="w-3.5 h-3.5" /> Resolve Report
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col justify-center items-center text-center p-8">
                <ShieldCheckIcon className="w-16 h-16 text-muted-foreground/20 mb-3" />
                <h3 className="text-base font-black uppercase tracking-wider text-muted-foreground">Select a Report</h3>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                  Choose a ticket from the left queue to load full context details, content attachments, and moderation controls.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "lookup" && (
        <div className="bg-card border border-border/50 rounded-2xl p-6 space-y-6 animate-in slide-in-from-bottom-2">
          <div className="max-w-md space-y-1.5">
            <label htmlFor="user-lookup-search" className="text-xs font-black uppercase tracking-widest text-muted-foreground block">
              Global Account Scoped Search
            </label>
            <div className="relative">
              <input
                id="user-lookup-search"
                type="text"
                placeholder="Search username, email, or user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleUserLookup()}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                className="w-full bg-muted border border-border/50 rounded-xl py-3 pl-11 pr-4 text-xs font-semibold outline-hidden placeholder-muted-foreground"
              />
              <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground absolute left-4 top-3.5" />

              {/* Suggestions Popover */}
              {isFocused && searchQuery.trim().length >= 2 && (suggestions.length > 0 || isSearchingSuggestions) && (
                <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-card text-card-foreground border border-border/80 shadow-2xl rounded-2xl overflow-hidden p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  {isSearchingSuggestions ? (
                    <div className="py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                      Searching matches...
                    </div>
                  ) : (
                    <>
                      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest font-mono pl-2 block">
                        Suggested Users
                      </span>
                      <div className="max-h-[220px] overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                        {suggestions.map((sug) => (
                          <div
                            key={sug.id}
                            onMouseDown={() => {
                              setSearchQuery(sug.username);
                              handleUserLookup(sug.username);
                            }}
                            className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary cursor-pointer transition-colors"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0 font-serif font-black text-xs uppercase">
                              {sug.avatar ? (
                                <img src={sug.avatar} alt="" className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                sug.username.substring(0, 2)
                              )}
                            </div>
                            <div className="min-w-0 flex-grow">
                              <p className="text-xs font-bold text-foreground truncate">
                                {sug.name || sug.username}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                @{sug.username} • {sug.email}
                              </p>
                            </div>
                            <span className="text-[9px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                              {sug.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">Press Enter to lookup across all authorized namespaces.</p>
          </div>

          {isSearchingUser ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
              Retrieving profile and history data...
            </div>
          ) : lookupResult ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 border-t border-border/40 pt-6">
              {/* User details */}
              <div className="md:col-span-4 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0 font-serif font-black text-2xl uppercase">
                    {lookupResult.user.username.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-lg font-black">{lookupResult.user.name || "Anonymous User"}</h3>
                    <p className="text-xs text-muted-foreground">@{lookupResult.user.username}</p>
                    <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded mt-1 inline-block">
                      ID: {lookupResult.user.id}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/40 border border-border/30 rounded-xl p-4 space-y-3.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Platform Role:</span>
                    <span className="font-bold uppercase text-primary">{lookupResult.user.role}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Reputation Score:</span>
                    <span className={`font-black ${lookupResult.user.reputation >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {lookupResult.user.reputation}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Registered:</span>
                    <span className="font-medium">{new Date(lookupResult.user.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Direct Action Trigger */}
                <button
                  onClick={() => {
                    setModActionTarget({
                      userId: lookupResult.user.id,
                      username: lookupResult.user.username
                    });
                    setShowModActionModal(true);
                  }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
                >
                  Apply Restriction
                </button>
              </div>

              {/* Action logs */}
              <div className="md:col-span-8 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">Moderation History & Action Logs</h4>
                {lookupResult.history && lookupResult.history.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                    {lookupResult.history.map((action) => (
                      <div key={action.id} className="p-4 rounded-xl border border-border/30 bg-muted/20 space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-black uppercase text-rose-500 tracking-wider">
                            {action.type} {action.communityId ? "(Community)" : "(Platform)"}
                          </span>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">
                            {new Date(action.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <p className="text-xs text-foreground font-medium">"{action.reason}"</p>
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground border-t border-border/20 pt-2">
                          <span>Moderator: <strong>@{action.actor?.username}</strong></span>
                          <span>
                            Expires: <strong>{action.expiresAt ? new Date(action.expiresAt).toLocaleDateString() : "Permanent"}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-muted/20 rounded-xl border border-dashed border-border/40 text-xs text-muted-foreground italic font-medium">
                    This account has a clean record. No moderation enforcements exist.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground italic font-medium">
              Enter a search criteria above.
            </div>
          )}
        </div>
      )}

      {activeTab === "appeals" && canSeeAppeals && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-2">
          {/* Left Appeals Queue */}
          <div className="lg:col-span-5 bg-card border border-border/50 rounded-2xl p-5 flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between border-b border-border/50 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <ScaleIcon className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-sm font-black uppercase tracking-wider">Appeals Queue</h2>
              </div>
              <button
                onClick={fetchAppeals}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <ArrowPathIcon className="w-4 h-4" />
              </button>
            </div>

            {isLoadingAppeals ? (
              <div className="flex-1 flex flex-col justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading appeals...</p>
              </div>
            ) : appeals.length > 0 ? (
              <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1 scrollbar-thin">
                {appeals.map((appeal) => (
                  <div
                    key={appeal.id}
                    onClick={() => setSelectedAppeal(appeal)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer ${selectedAppeal?.id === appeal.id ? "bg-primary/[0.06] border-primary/45 shadow-xs" : "border-border/30 hover:bg-muted/40"}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-black uppercase tracking-wider text-rose-500">Appeal for Action</span>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">
                        {new Date(appeal.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">"{appeal.reason}"</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Appellant: <strong className="text-foreground">@{appeal.user?.username || appeal.userId}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center items-center py-12 text-center">
                <ShieldCheckIcon className="w-12 h-12 text-muted-foreground/30 mb-2" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Appeals Queue Empty</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">No pending restriction appeals filed.</p>
              </div>
            )}
          </div>

          {/* Right Appeals Inspector */}
          <div className="lg:col-span-7 bg-card border border-border/50 rounded-2xl p-5 flex flex-col min-h-[500px]">
            {selectedAppeal ? (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="flex items-start justify-between border-b border-border/50 pb-4">
                    <div>
                      <h2 className="text-xl font-black font-serif">Review Restriction Appeal</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Appeal ID: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">{selectedAppeal.id}</code>
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedAppeal(null)}
                      className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 bg-muted/30 border border-border/30 rounded-xl space-y-2">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">Original Enforcement Action</span>
                    {selectedAppeal.action ? (
                      <div className="text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Enforcement Type:</span>
                          <span className="font-bold uppercase text-rose-500">{selectedAppeal.action.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Original Reason:</span>
                          <span className="font-bold">"{selectedAppeal.action.reason}"</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Issued At:</span>
                          <span className="font-medium">{new Date(selectedAppeal.action.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Enforcement record could not be loaded.</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block">Appellant's Statement</span>
                    <div className="bg-muted/50 p-4 rounded-xl text-xs border border-border/30 whitespace-pre-wrap leading-relaxed text-foreground italic">
                      "{selectedAppeal.reason}"
                    </div>
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 flex gap-2.5 justify-end">
                  <button
                    onClick={() => triggerConfirmation(
                      "Reject Appeal",
                      "Provide rejection reason statement...",
                      (resolution) => handleResolveAppeal(selectedAppeal.id, "rejected", resolution)
                    )}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
                  >
                    Reject Appeal
                  </button>
                  <button
                    onClick={() => triggerConfirmation(
                      "Approve Appeal (Revokes Active Enforcement)",
                      "Provide approval reason statement...",
                      (resolution) => handleResolveAppeal(selectedAppeal.id, "approved", resolution)
                    )}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all cursor-pointer"
                  >
                    Approve & Revoke
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-grow flex flex-col justify-center items-center text-center p-8">
                <ScaleIcon className="w-16 h-16 text-muted-foreground/20 mb-3" />
                <h3 className="text-base font-black uppercase tracking-wider text-muted-foreground">Select Appeal Ticket</h3>
                <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                  Select an appeal from the queue to load details of original enforcement and process resolution commands.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b border-border/50 pb-4">
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-sm font-black uppercase tracking-wider">My Actions & Activity Log</h2>
            </div>
            <button
              onClick={fetchActionHistory}
              className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
              Retrieving action logs...
            </div>
          ) : filteredActionHistory.length > 0 ? (
            <div className="space-y-2 overflow-y-auto max-h-[500px] pr-1 scrollbar-thin">
              {filteredActionHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-xl border border-border/30 hover:bg-muted/10 space-y-1.5 text-xs">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-primary">{item.action}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{new Date(item.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-relaxed">"{item.details}"</p>
                  <p className="text-[9px] text-muted-foreground/70">Target Resource ID: {item.targetId || "N/A"}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-muted-foreground italic font-medium">
              You haven't recorded any moderation enforcements in this session.
            </div>
          )}
        </div>
      )}

      {/* Enforcement Action Modal */}
      {showModActionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-md w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button
              onClick={() => setShowModActionModal(false)}
              className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-black font-serif">Apply User Restriction</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Target Account: @{modActionTarget.username}</p>
            </div>

            <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Action Type</label>
                <select
                  value={modActionForm.type}
                  onChange={(e) => setModActionForm({ ...modActionForm, type: e.target.value })}
                  className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                >
                  <option value="warn">Issue Official Warning</option>
                  <option value="mute">Mute Chat Capabilities</option>
                  <option value="suspend">Temporary Account Suspension</option>
                  {["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(userRole) && <option value="ban">Permanent Platform Ban</option>}
                </select>
              </div>

              {modActionForm.type !== "warn" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Duration</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        id="perm"
                        checked={modActionForm.permanent}
                        onChange={(e) => setModActionForm({ ...modActionForm, permanent: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor="perm" className="text-[10px] text-muted-foreground font-bold">Permanent</label>
                    </div>
                  </div>
                  {!modActionForm.permanent && (
                    <input
                      type="number"
                      min="1"
                      value={modActionForm.durationDays}
                      onChange={(e) => setModActionForm({ ...modActionForm, durationDays: parseInt(e.target.value) || 1 })}
                      placeholder="Duration in days"
                      className="w-full bg-muted border border-border/50 rounded-xl py-2 px-3 outline-hidden"
                    />
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Reason Statement</label>
                <textarea
                  placeholder="Describe infraction context..."
                  value={modActionForm.reason}
                  onChange={(e) => setModActionForm({ ...modActionForm, reason: e.target.value })}
                  className="w-full bg-muted border border-border/50 rounded-xl p-3 h-24 outline-hidden resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setShowModActionModal(false)}
                className="px-4 py-2 text-xs font-bold uppercase bg-muted border border-border/30 rounded-xl text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteModAction}
                className="px-4 py-2 text-xs font-bold uppercase bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
              >
                Apply Restriction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Statement Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-md w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <div>
              <h3 className="text-lg font-black font-serif">{showConfirmation}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Please provide reasoning statement to execute this administrative log.</p>
            </div>

            <div className="space-y-3">
              <textarea
                placeholder="Reason statement..."
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="w-full bg-muted border border-border/50 rounded-xl p-3 h-24 text-xs font-semibold outline-hidden resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setConfirmText("");
                }}
                className="px-4 py-2 text-xs font-bold uppercase bg-muted border border-border/30 rounded-xl text-foreground transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmCallback(confirmText)}
                className="px-4 py-2 text-xs font-bold uppercase bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ModeratorDashboard;
