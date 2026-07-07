import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ChatBubbleLeftRightIcon,
  TrophyIcon,
  StarIcon,
  BoltIcon,
  CalendarIcon,
  ShieldExclamationIcon,
  EllipsisVerticalIcon,
  ShieldCheckIcon,
  XMarkIcon,
  UserMinusIcon,
  PencilSquareIcon,
  CheckIcon,
  PaintBrushIcon,
  UserIcon,
  Squares2X2Icon,
  UsersIcon,
  UserPlusIcon,
  ClockIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowRightIcon,
  BookOpenIcon,
  Cog6ToothIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  CameraIcon,
  ChevronRightIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";

import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useSocial } from "@/hooks/useSocial";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppDispatch } from "@/store";
import { setUser } from "@/store/slices/authSlice";
import { apiClient } from "@/services/apiClient";
import { cn } from "@/utils/cn";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

/* ─── Constants ─────────────────────────────────────────────── */

const BANNER_PRESETS = [
  { name: "Crimson Sunset", value: "bg-gradient-to-r from-red-600 via-red-500 to-red-800" },
  { name: "Cosmic Midnight", value: "bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900" },
  { name: "Emerald Aurora", value: "bg-gradient-to-r from-teal-500 via-emerald-600 to-green-700" },
  { name: "Electric Violet", value: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700" },
  { name: "Sunrise Orange", value: "bg-gradient-to-r from-amber-500 via-orange-600 to-red-600" },
  { name: "Cyberpunk", value: "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-800" },
  { name: "Obsidian", value: "bg-gradient-to-r from-zinc-800 to-zinc-950" },
  { name: "Golden", value: "bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600" },
];

const RANK_TIERS = [
  { min: 0, max: 19, label: "Novice Citizen", accent: "#94a3b8" },
  { min: 20, max: 49, label: "Active Debater", accent: "#10b981" },
  { min: 50, max: 99, label: "Catalyst Orator", accent: "#3b82f6" },
  { min: 100, max: 199, label: "Master Advocate", accent: "#8b5cf6" },
  { min: 200, max: 499, label: "Grandmaster Counsel", accent: "#f59e0b" },
  { min: 500, max: Infinity, label: "Archon of Consensus", accent: "#ef4444" },
];

function getCitizenRank(rep = 0) {
  const tier = RANK_TIERS.find(t => rep >= t.min && rep <= t.max) || RANK_TIERS[0];
  const idx = RANK_TIERS.indexOf(tier);
  const next = RANK_TIERS[idx + 1] || null;
  const progress = next
    ? Math.min(100, Math.round(((rep - tier.min) / (tier.max - tier.min + 1)) * 100))
    : 100;
  return { ...tier, next, progress, tierIndex: idx };
}

function parseTopTake(item) {
  if (item.type !== "top.take") return null;
  const m = item.description.match(/Shared a top take in room "([^"]+)": "([\s\S]+)" \((\d+) reactions\)/);
  return m
    ? { roomTitle: m[1], content: m[2], reactions: parseInt(m[3]) }
    : { roomTitle: item.room?.title || "Unknown Room", content: item.description, reactions: 0 };
}

const MILESTONE_CONFIG = {
  "user.registered": { icon: UserIcon, color: "#3b82f6", label: "Joined the network" },
  "community.created": { icon: Squares2X2Icon, color: "#8b5cf6", label: "Founded a community" },
  "community.joined": { icon: UsersIcon, color: "#6366f1", label: "Joined a community" },
  "room.created": { icon: ChatBubbleLeftRightIcon, color: "#ec4899", label: "Opened a chamber" },
  "room.joined": { icon: ChatBubbleLeftRightIcon, color: "#10b981", label: "Entered a chamber" },
  "friend.accepted": { icon: UserPlusIcon, color: "#f59e0b", label: "Gained an ally" },
  default: { icon: BoltIcon, color: "#94a3b8", label: "Network activity" },
};

/* ─── Tiny reusable pieces ───────────────────────────────────── */

function Divider({ className }) {
  return <div className={cn("border-t border-border/50", className)} />;
}

function Label({ children, className }) {
  return (
    <span
      className={cn("text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground", className)}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {children}
    </span>
  );
}

function StatPill({ label, value }) {
  const isTextVal = typeof value === "string" && value.length > 8;
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "font-bold leading-none text-foreground",
          isTextVal ? "text-lg py-1.5" : "text-[28px]"
        )}
        style={{ fontFamily: "'DM Serif Display', serif" }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <Label>{label}</Label>
    </div>
  );
}

/* ─── Room Contribution Pie Chart ───────────────────────────── */

const PIE_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#a855f7", // Purple
  "#14b8a6", // Teal
];

function RoomContributionPieChart({ contributions = [], isLoading }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, roomTitle: "", count: 0, percentage: 0 });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] w-full gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-light">Loading contributions...</p>
      </div>
    );
  }

  const totalCount = contributions.reduce((sum, item) => sum + item.messageCount, 0);

  if (totalCount === 0 || contributions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] w-full gap-4 text-center px-6">
        <div className="w-20 h-20 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center opacity-70">
          <svg className="w-8 h-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No monthly contributions yet</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed font-light">
            Send messages in rooms to see your contribution breakdown for this month.
          </p>
        </div>
      </div>
    );
  }

  // SVG parameters (center at 170,170 with viewport 340x340 to allow room for hover animations)
  const cx = 170;
  const cy = 170;
  const radius = 160;

  // Calculate slice paths
  let currentAngle = -Math.PI / 2; // Start at 12 o'clock

  const slices = contributions.map((item, idx) => {
    const sliceAngle = (item.messageCount / totalCount) * 2 * Math.PI;
    const endAngle = currentAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(currentAngle);
    const y1 = cy + radius * Math.sin(currentAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;
    const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    const prevAngle = currentAngle;
    currentAngle = endAngle;

    return {
      pathData,
      color: PIE_COLORS[idx % PIE_COLORS.length],
      item,
      idx,
      midAngle: prevAngle + sliceAngle / 2
    };
  });

  const handleSliceMouseEnter = (idx, slice) => {
    setHoveredIdx(idx);
    const midX = cx + (radius * 0.55) * Math.cos(slice.midAngle);
    const midY = cy + (radius * 0.55) * Math.sin(slice.midAngle);
    const pctX = (midX / 340) * 100;
    const pctY = (midY / 340) * 100;
    setTooltip({
      visible: true,
      x: pctX,
      y: pctY,
      roomTitle: slice.item.roomTitle,
      count: slice.item.messageCount,
      percentage: slice.item.percentage
    });
  };

  const handleCircleMouseEnter = () => {
    setHoveredIdx(0);
    setTooltip({
      visible: true,
      x: 50,
      y: 35,
      roomTitle: contributions[0].roomTitle,
      count: contributions[0].messageCount,
      percentage: contributions[0].percentage
    });
  };

  return (
    <div className="pie-chart-container relative w-full flex items-center justify-center p-6 min-h-[350px]">
      <div 
        className="relative w-full max-w-[340px] aspect-square"
        onMouseLeave={() => setTooltip(prev => ({ ...prev, visible: false }))}
      >
        <svg viewBox="0 0 340 340" className="w-full h-full overflow-visible">
          {contributions.length === 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={PIE_COLORS[0]}
              className="transition-all duration-300 cursor-pointer origin-center hover:scale-[1.03]"
              onMouseEnter={handleCircleMouseEnter}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ) : (
            slices.map((slice, idx) => {
              const isHovered = hoveredIdx === idx;
              const offsetDistance = isHovered ? 8 : 0;
              const offsetX = offsetDistance * Math.cos(slice.midAngle);
              const offsetY = offsetDistance * Math.sin(slice.midAngle);

              return (
                <path
                  key={idx}
                  d={slice.pathData}
                  fill={slice.color}
                  className="transition-all duration-300 ease-out cursor-pointer"
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px)`,
                    filter: isHovered ? "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" : "none",
                    opacity: hoveredIdx !== null && !isHovered ? 0.6 : 1,
                  }}
                  onMouseEnter={() => handleSliceMouseEnter(idx, slice)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })
          )}
        </svg>

        {/* Floating Tooltip */}
        {tooltip.visible && (
          <div
            className="absolute z-50 pointer-events-none bg-zinc-950/95 text-zinc-50 border border-zinc-800 rounded-xl p-3 shadow-xl backdrop-blur-md min-w-[160px] flex flex-col gap-1 transition-all duration-75 text-left"
            style={{
              left: `${tooltip.x}%`,
              top: `${tooltip.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Room</span>
            <span className="text-xs font-semibold text-zinc-200 line-clamp-1">{tooltip.roomTitle}</span>
            <div className="h-px bg-zinc-800 my-1" />
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Contributions</span>
              <span className="font-bold text-zinc-200">{tooltip.count} {tooltip.count === 1 ? 'msg' : 'msgs'}</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Percentage</span>
              <span className="font-bold text-emerald-400">{tooltip.percentage}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


/* ─── Modal wrapper ─────────────────────────────────────────── */
function Modal({ open, onClose, title, icon: Icon, children, maxWidth = "max-w-md" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={cn(
          "bg-card border border-border/60 rounded-3xl w-full p-7 shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-150",
          maxWidth
        )}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="w-[17px] h-[17px] text-primary" />}
            <h3 style={{ fontFamily: "'DM Serif Display', serif" }} className="text-xl text-foreground">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────── */

export function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user: currentUser, logout } = useAuth();
  const { useUserStatsQuery, useUserFeedQuery, useUserContributionsQuery } = useAnalytics();
  const {
    blockUserMutation, unblockUserMutation,
    sendFriendRequestMutation, acceptFriendRequestMutation,
    removeFriendMutation, usePendingRequestsQuery,
  } = useSocial();

  const isOwnProfile = !id || id === currentUser?.id;
  const targetId = isOwnProfile ? currentUser?.id : id;

  const [resolvedUser, setResolvedUser] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState("none");
  const [isBlockedByUs, setIsBlockedByUs] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [ownedRooms, setOwnedRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [visibleRooms, setVisibleRooms] = useState(6);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState("activity");

  // Modal states
  const [modal, setModal] = useState(null); // null | 'edit' | 'banner' | 'blocked' | 'settings' | 'delete'

  // Edit form
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [deleteMode, setDeleteMode] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const { data: stats, isLoading: statsLoading } = useUserStatsQuery(targetId);
  const { data: activityFeed = [], isLoading: feedLoading } = useUserFeedQuery(targetId);
  const { data: contributions = [], isLoading: contributionsLoading } = useUserContributionsQuery(targetId);
  const { data: pendingRequests = [] } = usePendingRequestsQuery();

  /* ── Data fetching ── */
  useEffect(() => {
    if (!targetId) return;
    setIsLoadingProfile(true);
    apiClient.get(`/users/${targetId}`)
      .then(res => {
        setResolvedUser(res.data.data);
        setIsBlockedByUs(res.data.data.isBlocked);
        setFriendshipStatus(res.data.data.friendshipStatus);
      })
      .catch(err => setFetchError(err.message || "Failed to load profile"))
      .finally(() => setIsLoadingProfile(false));
  }, [targetId]);

  useEffect(() => {
    if (resolvedUser?.email) setNewEmail(resolvedUser.email);
  }, [resolvedUser]);

  useEffect(() => {
    if (!targetId) return;
    setIsLoadingRooms(true);
    apiClient.get(`/users/${targetId}/rooms-owned`)
      .then(res => setOwnedRooms(res.data.data))
      .catch(err => console.error(err))
      .finally(() => setIsLoadingRooms(false));
  }, [targetId]);

  /* ── Handlers ── */
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    const t = toast.loading("Uploading photo…");
    try {
      const up = await apiClient.post("/users/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const res = await apiClient.put("/users/profile", { avatar: up.data.data.url });
      setResolvedUser(res.data.data);
      dispatch(setUser(res.data.data));
      toast.success("Photo updated", { id: t });
    } catch (err) { toast.error(err.message || "Upload failed", { id: t }); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const t = toast.loading("Saving…");
    try {
      const res = await apiClient.put("/users/profile", { name: editName, bio: editBio, banner: editBanner });
      setResolvedUser(res.data.data); dispatch(setUser(res.data.data));
      setModal(null); toast.success("Profile saved", { id: t });
    } catch (err) { toast.error(err.message || "Failed to save", { id: t }); }
  };

  const handleUpdateBanner = async (val) => {
    const t = toast.loading("Updating banner…");
    try {
      const res = await apiClient.put("/users/profile", { banner: val });
      setResolvedUser(res.data.data); dispatch(setUser(res.data.data));
      setModal(null); toast.success("Banner updated", { id: t });
    } catch (err) { toast.error(err.message || "Failed", { id: t }); }
  };

  const fetchBlockedUsers = async () => {
    setIsLoadingBlocked(true);
    try { const res = await apiClient.get("/blocks"); setBlockedUsers(res.data.data); }
    catch (err) { toast.error(err.message); }
    finally { setIsLoadingBlocked(false); }
  };

  const handleUnblockUser = async (bid) => {
    try {
      await unblockUserMutation.mutateAsync(bid);
      setBlockedUsers(p => p.filter(u => u.id !== bid));
      toast.success("Unblocked");
    } catch (err) { toast.error(err.message); }
  };

  const handleAddFriend = async () => { try { await sendFriendRequestMutation.mutateAsync(targetId); setFriendshipStatus("pending_sent"); toast.success("Request sent"); } catch (e) { toast.error(e.message); } };
  const handleAcceptFriend = async () => { try { const r = pendingRequests.find(r => r.user.id === targetId); if (r) { await acceptFriendRequestMutation.mutateAsync(r.id); setFriendshipStatus("friends"); toast.success("Request accepted"); } } catch (e) { toast.error(e.message); } };
  const handleRemoveFriend = async () => { if (!confirm("Remove ally?")) return; try { await removeFriendMutation.mutateAsync(targetId); setFriendshipStatus("none"); toast.success("Removed"); } catch (e) { toast.error(e.message); } };
  const handleBlockUser = async () => { if (!confirm("Block this user?")) return; try { await blockUserMutation.mutateAsync(targetId); setIsBlockedByUs(true); setFriendshipStatus("none"); toast.success("Blocked"); } catch (e) { toast.error(e.message); } };
  const handleUnblockDirect = async () => { try { await unblockUserMutation.mutateAsync(targetId); setIsBlockedByUs(false); setFriendshipStatus("none"); toast.success("Unblocked"); } catch (e) { toast.error(e.message); } };

  const handleTogglePause = async () => {
    try {
      const res = await apiClient.post("/users/pause");
      if (res.data.success) { setResolvedUser(p => ({ ...p, isPaused: res.data.data.isPaused })); toast.success(res.data.data.isPaused ? "Paused" : "Resumed"); }
    } catch (e) { toast.error(e.message); }
  };

  const handleDeleteAccount = async () => {
    if (!deleteMode) return;
    setIsDeleting(true);
    try {
      const res = await apiClient.post("/users/delete", { mode: deleteMode });
      if (res.data.success) { toast.success(res.data.message); setModal(null); logout(); navigate("/"); }
    } catch (e) { toast.error(e.message); }
    finally { setIsDeleting(false); }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail) return;
    setIsUpdatingCreds(true);
    try {
      const res = await apiClient.put("/users/profile/credentials", { email: newEmail });
      if (res.data.success) { setResolvedUser(p => ({ ...p, email: res.data.data.email })); toast.success("Email updated"); }
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setIsUpdatingCreds(false); }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 8) return;
    setIsUpdatingCreds(true);
    try {
      const res = await apiClient.put("/users/profile/credentials", { password: newPassword });
      if (res.data.success) { setNewPassword(""); toast.success("Password updated"); }
    } catch (e) { toast.error(e.response?.data?.error || e.message); }
    finally { setIsUpdatingCreds(false); }
  };

  /* ── Loading / error states ── */
  if (isLoadingProfile || statsLoading || feedLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Loading profile…
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-5 text-center max-w-sm mx-auto">
        <ShieldExclamationIcon className="w-10 h-10 text-destructive" />
        <div>
          <h3 className="text-xl font-semibold text-foreground mb-1" style={{ fontFamily: "'DM Serif Display', serif" }}>
            Access Restricted
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {fetchError.includes("blocked") ? "You cannot view this profile." : fetchError}
          </p>
        </div>
        <Button onClick={() => navigate("/home")} variant="outline" className="rounded-xl">
          Return home
        </Button>
      </div>
    );
  }

  const profileUser = resolvedUser || currentUser;
  if (!profileUser) return null;

  /* ── Derived data ── */
  const rank = getCitizenRank(profileUser.reputation || 0);
  const topTakes = activityFeed.filter(i => i.type === "top.take");
  const spotlight = topTakes.length > 0 ? parseTopTake(topTakes[0]) : null;
  const milestones = activityFeed.filter(i => i.type !== "top.take");
  const dailyRate = stats?.accountAgeDays > 0 ? (stats.nonWorldChatMessagesSent / stats.accountAgeDays).toFixed(1) : (stats?.nonWorldChatMessagesSent || 0);

  const bannerClass = (() => {
    const b = profileUser.banner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800";
    return b.startsWith("bg-") ? b : `bg-gradient-to-r ${b}`;
  })();

  const joinedDate = (() => {
    if (!profileUser.createdAt) return null;
    const d = new Date(profileUser.createdAt);
    return isNaN(d) ? null : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  })();

  const joinedDateShort = (() => {
    if (!profileUser.createdAt) return null;
    const d = new Date(profileUser.createdAt);
    return isNaN(d) ? null : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  })();

  const formatContributions = (val) => {
    if (typeof val !== "number") return val;
    if (val >= 1000000) {
      return (val / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    }
    if (val >= 10000) {
      return (val / 1000).toFixed(0) + "k";
    }
    return val.toLocaleString();
  };

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div
      className="w-full pb-16 space-y-0"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >

      {/* ══════════════════════════════════════════
          HERO CARD  — banner / avatar / identity
      ══════════════════════════════════════════ */}
      <div className="rounded-3xl overflow-hidden border border-border/50 bg-card shadow-sm">

        {/* Banner */}
        <div className={cn("relative h-44 w-full", bannerClass)}>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
          {isOwnProfile && (
            <button
              onClick={() => { setEditBanner(profileUser.banner || ""); setModal("banner"); }}
              className="absolute bottom-3 right-4 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/25 hover:bg-black/40 backdrop-blur-sm border border-white/15 text-white text-xs font-medium transition-all"
            >
              <PaintBrushIcon className="w-3 h-3" /> Change banner
            </button>
          )}
        </div>

        {/* Identity row */}
        <div className="px-8 pb-8 pt-0">
          <div className="flex items-end justify-between -mt-12 mb-6">

            {/* Avatar */}
            <div className="relative group">
              <div
                className="rounded-full p-[3px]"
                style={{ background: `linear-gradient(135deg, ${rank.accent}, ${rank.accent}55)`, boxShadow: `0 0 0 3px var(--card)` }}
              >
                <Avatar
                  src={profileUser.avatar}
                  name={profileUser.username}
                  size="xl"
                  className="w-24 h-24 border-0 rounded-full"
                />
              </div>
              {isOwnProfile && (
                <>
                  <button
                    onClick={() => document.getElementById("avatar-upload").click()}
                    className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/45 transition-all duration-200"
                  >
                    <CameraIcon className="w-[18px] h-[18px] text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <input id="avatar-upload" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pb-1">
              {!isOwnProfile ? (
                <>
                  {isBlockedByUs ? (
                    <Button onClick={handleUnblockDirect} variant="outline" className="h-9 px-5 rounded-xl text-sm font-medium">
                      Unblock
                    </Button>
                  ) : (
                    <>
                      {friendshipStatus === "friends" && (
                        <Button onClick={handleRemoveFriend} variant="outline" className="h-9 px-5 rounded-xl text-sm font-medium border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                          Remove Ally
                        </Button>
                      )}
                      {friendshipStatus === "pending_received" && (
                        <Button onClick={handleAcceptFriend} className="h-9 px-5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700">
                          Accept Request
                        </Button>
                      )}
                      {friendshipStatus === "pending_sent" && (
                        <Button disabled variant="outline" className="h-9 px-5 rounded-xl text-sm font-medium">
                          Request Sent
                        </Button>
                      )}
                      {friendshipStatus === "none" && (
                        <Button onClick={handleAddFriend} className="h-9 px-5 rounded-xl text-sm font-medium">
                          Add Ally
                        </Button>
                      )}
                      <Button onClick={handleBlockUser} variant="outline"
                        className="h-9 px-4 rounded-xl text-sm font-medium border-border/50 text-muted-foreground hover:text-destructive hover:border-destructive/30">
                        <ShieldExclamationIcon className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Button
                    onClick={() => { setEditName(profileUser.name || ""); setEditBio(profileUser.bio || ""); setEditBanner(profileUser.banner || ""); setModal("edit"); }}
                    variant="outline"
                    className="h-9 px-5 rounded-xl text-sm font-medium border-border/60"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5 mr-2" /> Edit profile
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline-hidden" size="icon" className="h-8 w-7 border-border/60 cursor-pointer">
                        <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 bg-card border border-border rounded-2xl p-1.5 shadow-xl z-50">
                      <DropdownMenuItem onClick={() => document.getElementById("avatar-upload").click()}
                        className="rounded-xl px-3 py-2 text-sm cursor-pointer flex items-center gap-2.5">
                        <CameraIcon className="w-3.5 h-3.5 text-muted-foreground" /> Change photo
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditBanner(profileUser.banner || ""); setModal("banner"); }}
                        className="rounded-xl px-3 py-2 text-sm cursor-pointer flex items-center gap-2.5">
                        <PaintBrushIcon className="w-3.5 h-3.5 text-muted-foreground" /> Change banner
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setModal("settings")}
                        className="rounded-xl px-3 py-2 text-sm cursor-pointer flex items-center gap-2.5">
                        <Cog6ToothIcon className="w-3.5 h-3.5 text-muted-foreground" /> Account settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 border-border/40" />
                      <DropdownMenuItem onClick={() => { fetchBlockedUsers(); setModal("blocked"); }}
                        className="rounded-xl px-3 py-2 text-sm cursor-pointer flex items-center gap-2.5 text-destructive focus:text-destructive">
                        <UserMinusIcon className="w-3.5 h-3.5" /> Blocked citizens
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>

          {/* Name + meta */}
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1
                  className="text-3xl text-foreground leading-tight"
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                >
                  {profileUser.name || profileUser.username}
                </h1>
                {profileUser.verified && <Badge variant="verified" size="sm" />}
                {profileUser.isPaused && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    <PauseIcon className="w-2.5 h-2.5" /> Paused
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-sm">@{profileUser.username}</p>
            </div>

            {/* Badges */}
            {profileUser.badges?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {profileUser.badges.map(b => (
                  <Badge key={b} variant={b.toLowerCase().replace(" ", "-")} size="sm" />
                ))}
              </div>
            )}

            {/* Bio */}
            {profileUser.bio && (
              <p className="text-base text-foreground/80 leading-relaxed max-w-2xl font-light">
                {profileUser.bio}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {joinedDate && (
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" /> Joined {joinedDate}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <UsersIcon className="w-3.5 h-3.5" /> {stats?.friends || 0} allies
              </span>
              <span className="flex items-center gap-1.5">
                <Squares2X2Icon className="w-3.5 h-3.5" /> {stats?.communitiesJoined || 0} communities
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
          STATS ROW
      ══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/40 border border-border/40 rounded-2xl overflow-hidden mt-4">
        {[
          { label: "Reputation", value: (profileUser.reputation || 0) + " XP" },
          { label: "Contributions", value: formatContributions(stats?.messagesSent || 0) },
          { label: "Rooms Created", value: stats?.roomsCreated || 0 },
          { label: "Login Streak", value: (stats?.streak || 0) + " days" },
          { label: joinedDateShort || "N/A", value: "Member since" }
        ].map(({ label, value }) => (
          <div key={label} className="bg-card px-6 py-5">
            <StatPill label={label} value={value} />
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TABS
      ══════════════════════════════════════════ */}
      <div className="mt-8 space-y-6">
        {/* Custom tab bar — underline style */}
        <div className="border-b border-border/50 flex gap-1">
          {[
            { id: "activity", label: "Activity" },
            { id: "badges", label: "Honours" },
            { id: "rooms", label: "Rooms" },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-5 py-3 text-sm transition-colors",
                activeTab === tab.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground font-normal"
              )}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* ── Activity ── */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* Left col — rank + quick figures */}
              <div className="lg:col-span-2 space-y-5">

                {/* Rank card */}
                <div
                  className="rounded-2xl border p-6 space-y-5"
                  style={{ borderColor: `${rank.accent}25`, background: `${rank.accent}06` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <Label>Consensus rank</Label>
                      <h3
                        className="text-2xl leading-tight"
                        style={{ fontFamily: "'DM Serif Display', serif", color: rank.accent }}
                      >
                        {rank.label}
                      </h3>
                    </div>
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${rank.accent}18`, color: rank.accent }}
                    >
                      <TrophyIcon className="w-[18px] h-[18px]" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{profileUser.reputation || 0} XP</span>
                      {rank.next && <span>Next: {rank.next.min}</span>}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${rank.progress}%`, background: rank.accent }}
                      />
                    </div>
                    {rank.next && (
                      <p className="text-xs text-muted-foreground">
                        {rank.next.min - (profileUser.reputation || 0)} more to reach{" "}
                        <span style={{ color: rank.next.accent }} className="font-medium">
                          {rank.next.label}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Oratory rate */}
                <div className="rounded-2xl border border-border/50 bg-card p-5 grid grid-cols-2 divide-x divide-border/40">
                  <div className="pr-4 space-y-0.5">
                    <span
                      className="text-2xl font-semibold text-foreground block"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      {dailyRate}
                    </span>
                    <Label>Takes / day</Label>
                  </div>
                  <div className="pl-4 space-y-0.5">
                    <span
                      className="text-2xl font-semibold text-foreground block"
                      style={{ fontFamily: "'DM Serif Display', serif" }}
                    >
                      {stats?.roomsJoined || 0}
                    </span>
                    <Label>Rooms Joined</Label>
                  </div>
                </div>

                {/* Spotlight / Oath */}
                {spotlight ? (
                  <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3 relative overflow-hidden">
                    <div className="absolute -bottom-3 -right-3 text-muted-foreground/6 pointer-events-none">
                      <ChatBubbleBottomCenterTextIcon className="w-[72px] h-[72px] stroke-[1]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <SparklesIcon className="w-3 h-3 text-amber-500" />
                      <Label>Top take</Label>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed font-light italic relative z-10 line-clamp-5"
                      style={{ fontFamily: "'DM Serif Display', serif" }}>
                      "{spotlight.content}"
                    </p>
                    <Divider />
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                      <span className="truncate max-w-[65%]">in "{spotlight.roomTitle}"</span>
                      <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                        <StarIcon className="w-2.5 h-2.5 fill-current" /> {spotlight.reactions}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-3 relative overflow-hidden">
                    <div className="absolute -bottom-3 -right-3 text-muted-foreground/6 pointer-events-none">
                      <BookOpenIcon className="w-[72px] h-[72px] stroke-[1]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3 h-3 text-primary" />
                      <Label>Citizen oath</Label>
                    </div>
                    <p className="text-sm text-foreground/70 leading-relaxed font-light italic"
                      style={{ fontFamily: "'DM Serif Display', serif" }}>
                      "I commit to seeking consensus, participating in thoughtful arguments, and respecting the diverse voices of this network."
                    </p>
                  </div>
                )}
              </div>

              {/* Right col — Room Contributions Pie Chart */}
              <div className="lg:col-span-3">
                <div className="relative h-full flex flex-col justify-center items-center min-h-[420px]">
                  {/* Top-left label to explain the chart */}
                  <div className="absolute top-5 left-6 flex flex-col gap-0.5 pointer-events-none">
                    <span 
                      className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      Room Contributions
                    </span>
                    <span className="text-[9px] text-muted-foreground/50 tracking-wider">
                      This Month
                    </span>
                  </div>

                  <RoomContributionPieChart contributions={contributions} isLoading={contributionsLoading} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Honours ── */}
        {activeTab === "badges" && (
          <div>
            {profileUser.badges?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {profileUser.badges.map(badge => (
                  <div
                    key={badge}
                    className="group rounded-2xl border border-border/50 bg-card p-6 flex items-start gap-4 hover:border-primary/25 hover:shadow-sm transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/8 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                      <TrophyIcon className="w-[18px] h-[18px]" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{badge}</h4>
                      <p className="text-xs text-muted-foreground font-light leading-relaxed">
                        Awarded for exceptional contributions to the network.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-border/40 bg-card/50 text-center">
                <TrophyIcon className="w-8 h-8 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">No honours earned yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1 font-light">Keep contributing to earn your first.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Rooms ── */}
        {activeTab === "rooms" && (
          <div>
            {isLoadingRooms ? (
              <div className="flex items-center justify-center py-24">
                <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : ownedRooms.length > 0 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ownedRooms.slice(0, visibleRooms).map(room => (
                    <div
                      key={room.id}
                      onClick={() => navigate(`/room/${room.id}`)}
                      className="group rounded-2xl border border-border/50 bg-card p-5 cursor-pointer hover:border-primary/25 hover:shadow-sm transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-primary">{room.category}</span>
                            {room.isPrivate && (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Private</span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                            {room.title}
                          </h4>
                        </div>
                        <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                      </div>
                      <p className="text-xs text-muted-foreground font-light line-clamp-2 leading-relaxed">
                        {room.description}
                      </p>
                      <Divider />
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" /> {room._count?.members || 0} members</span>
                        <span className="flex items-center gap-1"><ChatBubbleLeftRightIcon className="w-3 h-3" /> {room._count?.messages || 0} takes</span>
                      </div>
                    </div>
                  ))}
                </div>
                {ownedRooms.length > visibleRooms && (
                  <div className="text-center">
                    <Button variant="outline" onClick={() => setVisibleRooms(p => p + 6)} className="rounded-xl px-8 text-sm font-medium">
                      Load more
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-border/40 bg-card/50 text-center">
                <ChatBubbleLeftRightIcon className="w-8 h-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No rooms owned yet.</p>
              </div>
            )}
          </div>
        )}
      </div>


      {/* ══════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════ */}

      {/* Edit Profile */}
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit profile" icon={PencilSquareIcon}>
        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display name</label>
            <input
              type="text" value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="Your name" maxLength={50}
              className="w-full bg-muted/60 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Bio</label>
            <textarea
              value={editBio} onChange={e => setEditBio(e.target.value)}
              placeholder="A short bio…" maxLength={200} rows={3}
              className="w-full bg-muted/60 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Banner</label>
            <div className="grid grid-cols-4 gap-2">
              {BANNER_PRESETS.map(p => (
                <button key={p.value} type="button" onClick={() => setEditBanner(p.value)} title={p.name}
                  className={cn("h-9 rounded-xl relative overflow-hidden transition-all border-2", p.value,
                    editBanner === p.value ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-90")}>
                  {editBanner === p.value && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                      <CheckIcon className="w-3 h-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button type="button" variant="outline" className="rounded-xl px-5 h-9 text-sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" className="rounded-xl px-5 h-9 text-sm">Save changes</Button>
          </div>
        </form>
      </Modal>

      {/* Change Banner */}
      <Modal open={modal === "banner"} onClose={() => setModal(null)} title="Change banner" icon={PaintBrushIcon}>
        <div className="space-y-5">
          <div className={cn("h-20 w-full rounded-2xl transition-all duration-200",
            (() => { const b = editBanner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800"; return b.startsWith("bg-") ? b : `bg-gradient-to-r ${b}`; })()
          )} />
          <div className="grid grid-cols-4 gap-2">
            {BANNER_PRESETS.map(p => (
              <button key={p.value} type="button" onClick={() => setEditBanner(p.value)} title={p.name}
                className={cn("h-9 rounded-xl relative overflow-hidden transition-all border-2", p.value,
                  editBanner === p.value ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-90")}>
                {editBanner === p.value && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"><CheckIcon className="w-3 h-3" /></span>
                )}
              </button>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" className="rounded-xl px-5 h-9 text-sm" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="rounded-xl px-5 h-9 text-sm" onClick={() => handleUpdateBanner(editBanner)}>Apply</Button>
          </div>
        </div>
      </Modal>

      {/* Blocked Citizens */}
      <Modal open={modal === "blocked"} onClose={() => setModal(null)} title="Blocked citizens" icon={ShieldCheckIcon}>
        <div className="space-y-4">
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-none">
            {isLoadingBlocked ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : blockedUsers.length > 0 ? (
              blockedUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                  <div className="flex items-center gap-3">
                    <Avatar src={u.avatar} name={u.username} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.name || u.username}</p>
                      <p className="text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                  </div>
                  <Button onClick={() => handleUnblockUser(u.id)} variant="outline"
                    className="h-8 px-3 rounded-lg text-xs border-destructive/20 text-destructive hover:bg-destructive/10">
                    Unblock
                  </Button>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground font-light">No blocked citizens.</p>
            )}
          </div>
          <Button variant="outline" className="w-full rounded-xl h-9 text-sm" onClick={() => setModal(null)}>Close</Button>
        </div>
      </Modal>

      {/* Account Settings */}
      <Modal open={modal === "settings"} onClose={() => setModal(null)} title="Account settings" icon={Cog6ToothIcon}>
        <div className="space-y-4">
          {/* Pause */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/30 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Pause account</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-light max-w-[220px]">
                Hides your activity and status from other citizens.
              </p>
            </div>
            <Button onClick={handleTogglePause} variant={profileUser.isPaused ? "default" : "outline"}
              className="rounded-xl h-9 px-4 text-xs font-medium shrink-0">
              {profileUser.isPaused ? <><PlayIcon className="w-3 h-3 mr-1.5" />Resume</> : <><PauseIcon className="w-3 h-3 mr-1.5" />Pause</>}
            </Button>
          </div>

          {/* Credentials */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/30 space-y-3">
            <p className="text-sm font-medium text-foreground">Update credentials</p>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email address</label>
              <div className="flex gap-2">
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@example.com"
                  className="flex-1 bg-card border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground" />
                <Button onClick={handleUpdateEmail} disabled={isUpdatingCreds || newEmail === profileUser.email}
                  className="rounded-xl h-9 px-4 text-xs shrink-0">Update</Button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">New password</label>
              <div className="flex gap-2">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8+ characters"
                  className="flex-1 bg-card border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-primary text-foreground" />
                <Button onClick={handleUpdatePassword} disabled={isUpdatingCreds || !newPassword || newPassword.length < 8}
                  className="rounded-xl h-9 px-4 text-xs shrink-0">Change</Button>
              </div>
            </div>
          </div>

          {/* Danger */}
          <div className="p-4 rounded-xl border border-destructive/15 bg-destructive/4 space-y-2">
            <p className="text-sm font-medium text-destructive">Danger zone</p>
            <p className="text-xs text-muted-foreground font-light">Permanently remove your account and data.</p>
            <Button onClick={() => { setDeleteMode(null); setModal("delete"); }}
              className="w-full rounded-xl h-9 text-xs bg-destructive hover:bg-destructive/90 text-white">
              <TrashIcon className="w-3.5 h-3.5 mr-2" /> Delete account
            </Button>
          </div>
          <Button variant="outline" className="w-full rounded-xl h-9 text-sm" onClick={() => setModal(null)}>Close</Button>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal open={modal === "delete"} onClose={() => setModal(null)} title="Delete account" icon={TrashIcon}>
        {!deleteMode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground font-light leading-relaxed">
              Choose how to handle your content before deletion:
            </p>
            {[
              { mode: "cascade", title: "Delete everything", desc: "All rooms, messages, and communities you created will be permanently removed." },
              { mode: "anonymize", title: "Anonymise profile only", desc: "Your identity is removed, but your rooms and discussions remain for the community." },
            ].map(opt => (
              <button key={opt.mode} onClick={() => setDeleteMode(opt.mode)}
                className="w-full text-left p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/40 space-y-1 transition-all group">
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{opt.title}</p>
                <p className="text-xs text-muted-foreground font-light leading-relaxed">{opt.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-destructive/6 border border-destructive/15">
              <p className="text-sm text-foreground">Selected: <strong>{deleteMode === "cascade" ? "Delete everything" : "Anonymise only"}</strong></p>
              <p className="text-xs text-destructive mt-1">This cannot be undone.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl h-9 text-sm" onClick={() => setDeleteMode(null)}>Change</Button>
              <Button onClick={handleDeleteAccount} disabled={isDeleting}
                className="flex-1 rounded-xl h-9 text-sm bg-destructive hover:bg-destructive/90 text-white">
                {isDeleting ? "Deleting…" : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default UserProfile;
