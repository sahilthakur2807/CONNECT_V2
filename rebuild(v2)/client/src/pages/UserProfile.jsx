import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import {
  MessageSquare,
  Award,
  Star,
  Zap,
  Activity,
  Calendar,
  ShieldAlert,
  MoreVertical,
  Shield,
  X,
  UserX,
  Edit2,
  Trash2,
  Check,
  Palette
} from "lucide-react";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useSocial } from "@/hooks/useSocial";
import { useDiscovery } from "@/hooks/useDiscovery";
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

const BANNER_PRESETS = [
  { name: "Crimson Sunset (Default)", value: "bg-gradient-to-r from-red-600 via-red-500 to-red-800" },
  { name: "Cosmic Midnight", value: "bg-gradient-to-r from-indigo-900 via-slate-900 to-blue-900" },
  { name: "Emerald Aurora", value: "bg-gradient-to-r from-teal-500 via-emerald-600 to-green-700" },
  { name: "Electric Violet", value: "bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700" },
  { name: "Sunrise Orange", value: "bg-gradient-to-r from-amber-500 via-orange-600 to-red-600" },
  { name: "Cyberpunk Pink", value: "bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-800" },
  { name: "Sleek Obsidian", value: "bg-gradient-to-r from-zinc-800 to-zinc-950" },
  { name: "Golden Consensus", value: "bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600" }
];

export function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { user: currentUser } = useAuth();
  const { useUserStatsQuery, useUserFeedQuery } = useAnalytics();
  const {
    blockUserMutation,
    unblockUserMutation,
    sendFriendRequestMutation,
    acceptFriendRequestMutation,
    removeFriendMutation,
    usePendingRequestsQuery,
  } = useSocial();

  // Resolve which user profile we are viewing
  const isOwnProfile = !id || id === currentUser?.id;
  const targetId = isOwnProfile ? currentUser?.id : id;

  const [resolvedUser, setResolvedUser] = useState(null);
  const [friendshipStatus, setFriendshipStatus] = useState("none");
  const [isBlockedByUs, setIsBlockedByUs] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const [ownedRooms, setOwnedRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [visibleOwnedRoomsCount, setVisibleOwnedRoomsCount] = useState(6);

  // Modals / Dropdown states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBanner, setEditBanner] = useState("");
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);

  // Fetch Stats, Activity Feed and Pending Requests
  const { data: stats, isLoading: statsLoading } = useUserStatsQuery(targetId);
  const { data: activityFeed = [], isLoading: feedLoading } =
    useUserFeedQuery(targetId);
  const { data: pendingRequests = [] } = usePendingRequestsQuery();

  // 1. Fetch profile details (Friendship status, block status, etc.)
  const fetchUserProfile = async () => {
    setIsLoadingProfile(true);
    setFetchError(null);
    try {
      const res = await apiClient.get(`/users/${targetId}`);
      setResolvedUser(res.data.data);
      setIsBlockedByUs(res.data.data.isBlocked);
      setFriendshipStatus(res.data.data.friendshipStatus);
    } catch (err) {
      setFetchError(err.message || "Failed to load user profile");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (targetId) {
      fetchUserProfile();
    }
  }, [targetId]);

  // 2. Fetch owned rooms
  useEffect(() => {
    const fetchOwnedRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const res = await apiClient.get(`/users/${targetId}/rooms-owned`);
        setOwnedRooms(res.data.data);
      } catch (err) {
        console.error("Failed to fetch owned rooms:", err);
      } finally {
        setIsLoadingRooms(false);
      }
    };

    if (targetId) {
      fetchOwnedRooms();
    }
  }, [targetId]);

  // 3. Photo Upload Handler
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const uploadToast = toast.loading("Uploading new profile photo...");
    try {
      const uploadRes = await apiClient.post("/users/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const avatarUrl = uploadRes.data.data.url;

      const updateRes = await apiClient.put("/users/profile", {
        avatar: avatarUrl
      });
      
      const updatedUser = updateRes.data.data;
      setResolvedUser(updatedUser);
      dispatch(setUser(updatedUser)); // update globally
      toast.success("Profile photo updated successfully!", { id: uploadToast });
    } catch (err) {
      toast.error(err.message || "Failed to upload photo", { id: uploadToast });
    }
  };

  // 4. Update Profile Handler
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const updateToast = toast.loading("Updating profile details...");
    try {
      const updateRes = await apiClient.put("/users/profile", {
        name: editName,
        bio: editBio,
        banner: editBanner
      });
      const updatedUser = updateRes.data.data;
      setResolvedUser(updatedUser);
      dispatch(setUser(updatedUser)); // update globally
      setIsEditModalOpen(false);
      toast.success("Profile details updated successfully!", { id: updateToast });
    } catch (err) {
      toast.error(err.message || "Failed to update profile", { id: updateToast });
    }
  };

  // 4b. Update Banner Handler
  const handleUpdateBanner = async (selectedBanner) => {
    const updateToast = toast.loading("Updating banner style...");
    try {
      const updateRes = await apiClient.put("/users/profile", {
        banner: selectedBanner
      });
      const updatedUser = updateRes.data.data;
      setResolvedUser(updatedUser);
      dispatch(setUser(updatedUser)); // update globally
      setIsBannerModalOpen(false);
      toast.success("Banner style updated successfully!", { id: updateToast });
    } catch (err) {
      toast.error(err.message || "Failed to update banner", { id: updateToast });
    }
  };

  // 5. Block List popup handlers
  const fetchBlockedUsers = async () => {
    setIsLoadingBlocked(true);
    try {
      const res = await apiClient.get("/blocks");
      setBlockedUsers(res.data.data);
    } catch (err) {
      toast.error(err.message || "Failed to fetch blocked users");
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  const handleUnblockUser = async (blockedId) => {
    try {
      await apiClient.delete(`/blocks/${blockedId}`);
      toast.success("User unblocked successfully");
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedId));
    } catch (err) {
      toast.error(err.message || "Failed to unblock user");
    }
  };

  // 6. Social interaction action handlers
  const handleAddFriend = async () => {
    if (!targetId) return;
    try {
      await sendFriendRequestMutation.mutateAsync(targetId);
      setFriendshipStatus("pending_sent");
      toast.success("Friend request sent!");
    } catch (err) {
      toast.error(err.message || "Failed to send friend request");
    }
  };

  const handleAcceptFriendDirect = async () => {
    if (!targetId) return;
    try {
      const req = pendingRequests.find((r) => r.user.id === targetId);
      if (req) {
        await acceptFriendRequestMutation.mutateAsync(req.id);
        setFriendshipStatus("friends");
        toast.success("Friend request accepted!");
      }
    } catch (err) {
      toast.error(err.message || "Failed to accept friend request");
    }
  };

  const handleRemoveFriend = async () => {
    if (!targetId) return;
    if (!confirm("Are you sure you want to remove this citizen from your friends list?")) return;
    try {
      await removeFriendMutation.mutateAsync(targetId);
      setFriendshipStatus("none");
      toast.success("Friend removed successfully");
    } catch (err) {
      toast.error(err.message || "Failed to remove friend");
    }
  };

  const handleBlockUser = async () => {
    if (!targetId) return;
    if (!confirm("Are you sure you want to block this user?")) return;
    try {
      await blockUserMutation.mutateAsync(targetId);
      setIsBlockedByUs(true);
      setFriendshipStatus("none");
      toast.success("User blocked successfully");
    } catch (err) {
      toast.error(err.message || "Failed to block user");
    }
  };

  const handleUnblockUserDirect = async () => {
    if (!targetId) return;
    try {
      await unblockUserMutation.mutateAsync(targetId);
      setIsBlockedByUs(false);
      setFriendshipStatus("none");
      toast.success("User unblocked successfully");
    } catch (err) {
      toast.error(err.message || "Failed to unblock user");
    }
  };

  const isLoading = isLoadingProfile || statsLoading || feedLoading;

  if (isLoading) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-64 bg-background">
        <Activity className="animate-spin text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Resolving Profile...
        </p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col justify-center items-center py-20 bg-background/50 border border-border/40 rounded-[40px] shadow-sm max-w-2xl mx-auto px-6 text-center animate-in fade-in duration-300">
        <ShieldAlert className="text-destructive mb-6 animate-pulse" size={56} />
        <h3 className="text-2xl font-serif font-black text-foreground">Access Denied</h3>
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
          {fetchError.includes("blocked")
            ? "You cannot view this profile because you have been blocked by this user."
            : fetchError}
        </p>
        <Button onClick={() => navigate("/home")} className="mt-8 rounded-2xl font-bold uppercase text-xs tracking-wider px-6 h-11">
          Back to Safety
        </Button>
      </div>
    );
  }

  const profileUser = resolvedUser || currentUser;
  if (!profileUser) {
    return (
      <div className="text-center py-20 font-medium text-muted-foreground">
        User citizen profile not found in directory.
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-10 font-sans">
      <Card className="overflow-hidden border-border/50 rounded-[40px] shadow-sm bg-card animate-in fade-in duration-500">
        {/* Profile Banner */}
        <div className={cn(
          "h-48 w-full relative transition-all duration-300",
          (() => {
            const b = profileUser.banner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800";
            return b.includes("bg-") ? b : `bg-gradient-to-r ${b}`;
          })()
        )} />

        {/* Profile Card Header Info */}
        <div className="px-8 pb-8 relative">
          <div className="flex justify-between items-start -mt-20 mb-4">
            {/* Avatar overlapping banner */}
            <div className="relative p-1 bg-card rounded-full shadow-md inline-block">
              <Avatar
                src={profileUser.avatar}
                name={profileUser.username}
                size="xl"
                className="w-32 h-32 border-4 border-card"
                onClick={() => {
                  if (isOwnProfile) {
                    document.getElementById("avatar-file-input").click();
                  }
                }}
              />
            </div>

            {/* Action buttons (block/add friend for foreign profile) */}
            {!isOwnProfile ? (
              <div className="mt-24 flex gap-2">
                {isBlockedByUs ? (
                  <Button
                    onClick={handleUnblockUserDirect}
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
                  >
                    Unblock User
                  </Button>
                ) : (
                  <>
                    {friendshipStatus === "friends" ? (
                      <Button
                        onClick={handleRemoveFriend}
                        className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 cursor-pointer"
                      >
                        Remove Friend
                      </Button>
                    ) : friendshipStatus === "pending_received" ? (
                      <Button
                        onClick={handleAcceptFriendDirect}
                        className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                      >
                        Accept Request
                      </Button>
                    ) : friendshipStatus === "pending_sent" ? (
                      <Button
                        disabled
                        className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-muted text-muted-foreground border border-border/40"
                      >
                        Request Sent
                      </Button>
                    ) : (
                      <Button
                        onClick={handleAddFriend}
                        className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 cursor-pointer"
                      >
                        + Add Friend
                      </Button>
                    )}
                    <Button
                      onClick={handleBlockUser}
                      variant="outline"
                      className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 border-destructive/20 text-destructive hover:bg-destructive/10 h-10 px-5 cursor-pointer"
                    >
                      <ShieldAlert size={14} className="mr-2" /> Block User
                    </Button>
                  </>
                )}
              </div>
            ) : (
              /* Own Profile Settings Trigger */
              <div className="mt-24 flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button variant="outline" size="icon" className="rounded-2xl hover:bg-muted h-10 w-10 border-border/50">
                      <MoreVertical size={20} className="text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border border-border shadow-lg rounded-2xl p-2 z-50">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditName(profileUser.name || "");
                        setEditBio(profileUser.bio || "");
                        setEditBanner(profileUser.banner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800");
                        setIsEditModalOpen(true);
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-muted text-foreground flex items-center gap-2"
                    >
                      <Edit2 size={16} /> Edit Profile Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        document.getElementById("avatar-file-input").click();
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-muted text-foreground flex items-center gap-2"
                    >
                      <Zap size={16} /> Change Profile Photo
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditBanner(profileUser.banner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800");
                        setIsBannerModalOpen(true);
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold hover:bg-muted text-foreground flex items-center gap-2"
                    >
                      <Palette size={16} /> Change Banner Color
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="my-1 border-t border-border/40" />
                    <DropdownMenuItem
                      onClick={() => {
                        fetchBlockedUsers();
                        setIsBlockedModalOpen(true);
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 flex items-center gap-2"
                    >
                      <UserX size={16} /> Blocked Citizens
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <input
                  id="avatar-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-3xl text-foreground tracking-tight font-serif font-black">
                  {profileUser.name || profileUser.username}
                </h2>
                {profileUser.verified && (
                  <Badge variant="verified" size="sm" showIcon={false} />
                )}
              </div>
              <p
                className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                @{profileUser.username}
              </p>
            </div>

            {/* Badges Row */}
            {profileUser.badges && profileUser.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {profileUser.badges.map((b) => (
                  <Badge
                    key={b}
                    variant={b.toLowerCase().replace(" ", "-")}
                    size="sm"
                    className="rounded-lg px-2.5 py-1"
                  />
                ))}
              </div>
            )}

            {/* Bio */}
            <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-2xl italic font-serif">
              "{profileUser.bio || "This citizen has not set a bio yet."}"
            </p>

            {/* Joined Date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Calendar size={14} className="text-muted-foreground/80" />
              <span>
                Joined{" "}
                {(() => {
                  if (!profileUser.createdAt) return "Unknown Date";
                  const d = new Date(profileUser.createdAt);
                  return isNaN(d.getTime())
                    ? "Unknown Date"
                    : d.toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                      });
                })()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Stats Block */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
        {/* Debates Joined */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Debates Joined
              </p>
              <h3 className="text-3xl font-black text-foreground">
                {stats?.roomsJoined || 0}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-muted text-primary">
              <MessageSquare size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Reputation */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-amber-500/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Reputation
              </p>
              <h3 className="text-3xl font-black text-amber-500">
                {profileUser.reputation || 0}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <Star size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Contributions */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-blue-500/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p
                className="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Contributions
              </p>
              <h3 className="text-3xl font-black text-blue-500">
                {(stats?.messagesSent || 0).toLocaleString()}
              </h3>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
              <Zap size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs / Activity History Area */}
      <div className="w-full">
        <Tabs defaultValue="activity" className="space-y-8">
          <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
            <TabsList className="bg-transparent border-none p-0 flex gap-1">
              <TabsTrigger
                value="activity"
                className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Activity Feed
              </TabsTrigger>
              <TabsTrigger
                value="badges"
                className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Badges & Honors
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all"
              >
                Rooms Owned
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="activity" className="space-y-4">
            {activityFeed.length > 0 ? (
              activityFeed.map((item) => (
                <div
                  key={item.id}
                  className="p-8 bg-card border border-border/50 rounded-[32px] hover:border-primary/20 transition-all group flex items-start gap-6 animate-in fade-in"
                >
                  <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors text-muted-foreground group-hover:text-primary">
                    <Activity size={20} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-foreground capitalize">
                        {item.type.replace(/\./g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic bg-card rounded-[40px] border border-border/50">
                No activity logs recorded.
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="badges"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {profileUser.badges && profileUser.badges.length > 0 ? (
              profileUser.badges.map((badge) => (
                <div
                  key={badge}
                  className="p-8 bg-card border border-border/50 rounded-[32px] text-center space-y-4 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-default animate-in fade-in"
                >
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <Award size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">{badge}</h4>
                    <p className="text-xs text-muted-foreground font-medium">
                      Awarded for exceptional contributions to the network.
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic col-span-full bg-card rounded-[40px] border border-border/50">
                No badges awarded yet.
              </div>
            )}
          </TabsContent>

          {/* Rooms Owned Content */}
          <TabsContent value="rooms" className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {isLoadingRooms ? (
              <div className="py-20 text-center text-muted-foreground col-span-full font-bold uppercase tracking-widest text-xs">
                Retrieving Rooms...
              </div>
            ) : ownedRooms.length > 0 ? (
              <>
                {ownedRooms.slice(0, visibleOwnedRoomsCount).map((room) => (
                  <Card
                    key={room.id}
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="border-border/50 rounded-[32px] shadow-sm bg-card hover:border-primary/20 transition-all cursor-pointer group flex flex-col justify-between overflow-hidden hover:shadow-md"
                  >
                    <CardContent className="p-6 space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest font-mono">
                            {room.category}
                          </span>
                          {room.isPrivate && (
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md">
                              Private
                            </span>
                          )}
                        </div>
                        <h4 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                          {room.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {room.description}
                        </p>
                      </div>

                      <div className="flex gap-4 text-[10px] font-bold text-muted-foreground uppercase tracking-wider font-mono">
                        <span>{room._count?.members || 0} Citizens</span>
                        <span>{room._count?.messages || 0} Takes</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {ownedRooms.length > visibleOwnedRoomsCount && (
                  <div className="flex justify-center pt-4 col-span-full">
                    <Button
                      onClick={() => setVisibleOwnedRoomsCount((prev) => prev + 6)}
                      className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10 cursor-pointer"
                    >
                      Load More Rooms
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic col-span-full bg-card rounded-[40px] border border-border/50">
                No rooms owned by this citizen.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-[32px] w-full max-w-md p-8 space-y-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-serif font-black text-foreground">Edit Profile</h3>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted"
                onClick={() => setIsEditModalOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Citizen Name"
                  maxLength={50}
                  className="w-full bg-muted border border-border/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-foreground"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell others about yourself..."
                  maxLength={200}
                  rows={4}
                  className="w-full bg-muted border border-border/40 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-colors text-foreground resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Profile Banner Style</label>
                <div className="grid grid-cols-4 gap-2">
                  {BANNER_PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setEditBanner(p.value)}
                      title={p.name}
                      className={cn(
                        "h-8 rounded-lg relative overflow-hidden cursor-pointer border-2 transition-all",
                        p.value,
                        editBanner === p.value ? "border-primary scale-105 shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                      )}
                    >
                      {editBanner === p.value && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                          <Check size={12} className="font-bold" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl font-bold uppercase text-xs tracking-wider px-5"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-2xl font-bold uppercase text-xs tracking-wider px-5"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Blocked Users Modal */}
      {isBlockedModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-[32px] w-full max-w-md p-8 space-y-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="text-destructive" size={20} />
                <h3 className="text-xl font-serif font-black text-foreground">Blocked Citizens</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted"
                onClick={() => setIsBlockedModalOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-1 space-y-3">
              {isLoadingBlocked ? (
                <div className="py-8 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Loading list...
                </div>
              ) : blockedUsers.length > 0 ? (
                blockedUsers.map((blocked) => (
                  <div key={blocked.id} className="flex justify-between items-center p-4 bg-muted/40 border border-border/20 rounded-2xl hover:bg-muted/70 transition-all">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={blocked.avatar}
                        name={blocked.username}
                        size="sm"
                        className="w-9 h-9"
                      />
                      <div className="text-left">
                        <p className="text-sm font-bold text-foreground leading-tight">
                          {blocked.name || blocked.username}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          @{blocked.username}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleUnblockUser(blocked.id)}
                      className="rounded-xl font-bold uppercase text-[9px] tracking-wider h-8 px-3 bg-destructive hover:bg-destructive/90 text-white cursor-pointer"
                    >
                      Unblock
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm font-medium text-muted-foreground italic">
                  No blocked citizens.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                className="rounded-2xl font-bold uppercase text-xs tracking-wider px-5 w-full"
                onClick={() => setIsBlockedModalOpen(false)}
              >
                Close Window
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Change Banner Modal */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border/50 rounded-[32px] w-full max-w-md p-8 space-y-6 shadow-2xl animate-in scale-in duration-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Palette size={20} className="text-primary" />
                <h3 className="text-xl font-serif font-black text-foreground">Banner Style</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted"
                onClick={() => setIsBannerModalOpen(false)}
              >
                <X size={20} />
              </Button>
            </div>

            {/* Live Preview */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Preview</label>
              <div className={cn(
                "h-24 w-full rounded-2xl transition-all duration-300",
                (() => {
                  const b = editBanner || "bg-gradient-to-r from-red-600 via-red-500 to-red-800";
                  return b.includes("bg-") ? b : `bg-gradient-to-r ${b}`;
                })()
              )} />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Style</label>
              <div className="grid grid-cols-4 gap-2">
                {BANNER_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setEditBanner(p.value)}
                    title={p.name}
                    className={cn(
                      "h-8 rounded-lg relative overflow-hidden cursor-pointer border-2 transition-all",
                      p.value,
                      editBanner === p.value ? "border-primary scale-105 shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                  >
                    {editBanner === p.value && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                        <Check size={12} className="font-bold" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                className="rounded-2xl font-bold uppercase text-xs tracking-wider px-5"
                onClick={() => setIsBannerModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleUpdateBanner(editBanner)}
                className="rounded-2xl font-bold uppercase text-xs tracking-wider px-5"
              >
                Save Style
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserProfile;
