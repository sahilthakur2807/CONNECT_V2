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
  FireIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { ImageCropper } from "@/components/ui/ImageCropper";

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

/* ─── Achievements Configurations ───────────────────────────── */

const ACHIEVEMENT_BADGES = [
  {
    id: "verified",
    title: "Verified Citizen",
    description: "Identity verified by the consensus network moderation team.",
    requirement: "Verify your account",
    icon: ShieldCheckIcon,
    accent: "from-cyan-500 to-blue-600",
    glow: "rgba(6, 182, 212, 0.15)",
    checkUnlock: (user, stats) => user?.verified || user?.badges?.some(b => b.toLowerCase() === "verified"),
  },
  {
    id: "early-member",
    title: "Early Pioneer",
    description: "Joined the network in its early days to shape its foundation.",
    requirement: "Join in the platform's early phase",
    icon: ClockIcon,
    accent: "from-sky-400 to-indigo-600",
    glow: "rgba(56, 189, 248, 0.15)",
    checkUnlock: (user, stats) => user?.badges?.some(b => b.toLowerCase().replace(" ", "-") === "early-member" || b.toLowerCase().replace(" ", "-") === "early-adopter"),
  },
  {
    id: "top-contributor",
    title: "Elite Advocate",
    description: "Awarded for sending over 100 high-quality discussion takes.",
    requirement: "Send 100+ takes (messages)",
    icon: TrophyIcon,
    accent: "from-amber-400 to-orange-600",
    glow: "rgba(245, 158, 11, 0.15)",
    checkUnlock: (user, stats) => stats?.messagesSent >= 100 || user?.badges?.some(b => b.toLowerCase().replace(" ", "-") === "top-contributor"),
    currentProgress: (user, stats) => stats?.messagesSent || 0,
    targetProgress: () => 100,
  },
  {
    id: "chamber-architect",
    title: "Chamber Architect",
    description: "Founded 3 or more active discussion chambers.",
    requirement: "Create 3+ discussion rooms",
    icon: ChatBubbleLeftRightIcon,
    accent: "from-emerald-400 to-teal-600",
    glow: "rgba(52, 211, 153, 0.15)",
    checkUnlock: (user, stats) => stats?.roomsCreated >= 3,
    currentProgress: (user, stats) => stats?.roomsCreated || 0,
    targetProgress: () => 3,
  },
  {
    id: "devoted-citizen",
    title: "Devoted Citizen",
    description: "Maintained a consistent daily debate participation streak.",
    requirement: "Reach a 5-day login streak",
    icon: FireIcon,
    accent: "from-rose-500 to-red-600",
    glow: "rgba(244, 63, 94, 0.15)",
    checkUnlock: (user, stats) => stats?.streak >= 5,
    currentProgress: (user, stats) => stats?.streak || 0,
    targetProgress: () => 5,
  },
  {
    id: "social-catalyst",
    title: "Consensus Ally",
    description: "Formed mutual alliances with 5 or more network citizens.",
    requirement: "Connect with 5+ allies (friends)",
    icon: UsersIcon,
    accent: "from-pink-500 to-purple-600",
    glow: "rgba(236, 72, 153, 0.15)",
    checkUnlock: (user, stats) => stats?.friends >= 5,
    currentProgress: (user, stats) => stats?.friends || 0,
    targetProgress: () => 5,
  },
  {
    id: "community-founder",
    title: "Guild Pioneer",
    description: "Joined and participated in 3 or more local communities.",
    requirement: "Join 3+ communities",
    icon: Squares2X2Icon,
    accent: "from-violet-500 to-indigo-700",
    glow: "rgba(139, 92, 246, 0.15)",
    checkUnlock: (user, stats) => stats?.communitiesJoined >= 3,
    currentProgress: (user, stats) => stats?.communitiesJoined || 0,
    targetProgress: () => 3,
  },
  {
    id: "archon",
    title: "Archon of Consensus",
    description: "Achieved elite status by reaching 200+ Reputation XP.",
    requirement: "Reach 200+ Reputation XP",
    icon: SparklesIcon,
    accent: "from-yellow-400 to-amber-600",
    glow: "rgba(253, 224, 71, 0.15)",
    checkUnlock: (user, stats) => (user?.reputation || 0) >= 200,
    currentProgress: (user, stats) => user?.reputation || 0,
    targetProgress: () => 200,
  }
];


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
  const { useUserStatsQuery } = useAnalytics();
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
  const [activeTab, setActiveTab] = useState("rooms");

  // Modal states
  const [modal, setModal] = useState(null); // null | 'edit' | 'banner' | 'blocked' | 'settings' | 'delete'

  // Edit form
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [deleteMode, setDeleteMode] = useState(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdatingCreds, setIsUpdatingCreds] = useState(false);

  const { data: stats, isLoading: statsLoading } = useUserStatsQuery(targetId);
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
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAvatarFile(file);
  };

  const handleCroppedAvatarUpload = async (croppedFile) => {
    setPendingAvatarFile(null);
    const fd = new FormData();
    fd.append("avatar", croppedFile);
    const t = toast.loading("Uploading photo…");
    try {
      const up = await apiClient.post("/users/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const res = await apiClient.put("/users/profile", { avatar: up.data.data.url });
      setResolvedUser(res.data.data);
      dispatch(setUser(res.data.data));
      toast.success("Photo updated", { id: t });
    } catch (err) {
      toast.error(err.message || "Upload failed", { id: t });
    }
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
  if (isLoadingProfile || statsLoading) {
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

  const bannerClass = (() => {
    const b = profileUser.banner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800";
    return b.startsWith("bg-") ? b : `bg-gradient-to-r ${b}`;
  })();

  if (profileUser.isDeleted) {
    return (
      <div
        className="w-full pb-16 space-y-0 animate-in fade-in duration-300"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <div className="rounded-3xl overflow-hidden border border-border/50 bg-card shadow-sm">
          {/* Banner */}
          <div className={cn("relative h-44 w-full", bannerClass)}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
          </div>

          {/* Identity row */}
          <div className="px-8 pb-8 pt-0">
            <div className="flex items-end justify-between -mt-12 mb-6">
              {/* Avatar */}
              <div className="relative">
                <div
                  className="rounded-full p-[3px] bg-zinc-800"
                  style={{ boxShadow: `0 0 0 3px var(--card)` }}
                >
                  <Avatar
                    src={null}
                    name={profileUser.name || "Deleted Citizen"}
                    size="xl"
                    className="w-24 h-24 border-0 rounded-full bg-zinc-700"
                  />
                </div>
              </div>
            </div>

            {/* User Meta */}
            <div className="space-y-4">
              <div>
                <h2
                  style={{ fontFamily: "'DM Serif Display', serif" }}
                  className="text-[32px] leading-tight text-foreground font-bold"
                >
                  {profileUser.name || "Deleted Citizen"}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm font-semibold text-muted-foreground">
                    @{profileUser.username || "deleted_user"}
                  </span>
                </div>
              </div>

              <div className="p-8 bg-muted/30 border border-border/40 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
                <ShieldExclamationIcon className="w-8 h-8 text-muted-foreground/60" />
                <p className="text-sm font-semibold text-muted-foreground">
                  This citizen has deleted the account.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Derived data ── */
  const rank = getCitizenRank(profileUser.reputation || 0);

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
            { id: "rooms", label: "Rooms" },
            { id: "badges", label: "Badges" },
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

        {/* ── Badges ── */}
        {activeTab === "badges" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <h3 
                className="text-2xl text-foreground"
                style={{ fontFamily: "'DM Serif Display', serif" }}
              >
                Citizen Achievements
              </h3>
              <p className="text-sm text-muted-foreground font-light">
                Unlock achievements and honors by participating in constructive dialogue across the network.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {ACHIEVEMENT_BADGES.map(ach => {
                const isUnlocked = ach.checkUnlock(profileUser, stats);
                const IconComponent = ach.icon;
                
                // Progress calculations (if applicable)
                const current = ach.currentProgress ? ach.currentProgress(profileUser, stats) : null;
                const target = ach.targetProgress ? ach.targetProgress(profileUser, stats) : null;
                const percentage = current !== null && target !== null 
                  ? Math.min(100, Math.round((current / target) * 100)) 
                  : null;

                return (
                  <div
                    key={ach.id}
                    className={cn(
                      "group relative rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 overflow-hidden",
                      isUnlocked 
                        ? "bg-card border-border/60 hover:border-primary/30 shadow-sm hover:shadow-md hover:-translate-y-0.5" 
                        : "bg-muted/10 border-dashed border-border/70 opacity-60 hover:opacity-85"
                    )}
                    style={{
                      boxShadow: isUnlocked ? `0 8px 24px -10px ${ach.glow}` : "none"
                    }}
                  >
                    {/* Visual glowing aura for unlocked achievements */}
                    {isUnlocked && (
                      <div 
                        className={cn(
                          "absolute -right-16 -top-16 w-32 h-32 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30 bg-gradient-to-br",
                          ach.accent
                        )}
                      />
                    )}

                    <div className="space-y-4">
                      {/* Icon & Status header */}
                      <div className="flex items-center justify-between">
                        <div 
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300",
                            isUnlocked 
                              ? `bg-gradient-to-br ${ach.accent} text-white shadow-md` 
                              : "bg-muted/40 text-muted-foreground/60 border border-border/30"
                          )}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>

                        {/* Status Label */}
                        {isUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckIcon className="w-2.5 h-2.5 stroke-[3]" /> Unlocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-muted/40 text-muted-foreground/60 border border-border/20">
                            <LockClosedIcon className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="space-y-1">
                        <h4 className="text-base font-semibold text-foreground tracking-tight">
                          {ach.title}
                        </h4>
                        <p className="text-xs text-muted-foreground leading-relaxed font-light">
                          {ach.description}
                        </p>
                      </div>
                    </div>

                    {/* Progress indicator / requirements */}
                    <div className="mt-5 pt-4 border-t border-border/30">
                      {isUnlocked ? (
                        <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3 fill-current" /> Claimed Achievement
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span>Requirement: {ach.requirement}</span>
                            {percentage !== null && (
                              <span className="font-bold">{current}/{target} ({percentage}%)</span>
                            )}
                          </div>
                          {percentage !== null && (
                            <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-muted-foreground/35 rounded-full transition-all duration-500" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

      {/* Image Crop Overlay for Avatar */}
      {pendingAvatarFile && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-[60] p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[28px] max-w-md w-full p-6 space-y-4 relative shadow-2xl border border-border/50">
            <h3 className="text-lg font-bold font-serif text-foreground">Adjust Profile Photo</h3>
            <ImageCropper
              file={pendingAvatarFile}
              aspectRatio={1}
              onCropComplete={handleCroppedAvatarUpload}
              onCancel={() => {
                setPendingAvatarFile(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfile;
