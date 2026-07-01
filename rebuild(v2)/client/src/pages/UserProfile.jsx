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

export function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: currentUser } = useAuth();
  const { useUserStatsQuery, useUserFeedQuery } = useAnalytics();
  const {
    useFriendsQuery,
    usePendingRequestsQuery,
    blockUserMutation,
    sendFriendRequestMutation,
    acceptFriendRequestMutation,
  } = useSocial();
  const { useSearchUsersQuery } = useDiscovery();

  // Resolve which user profile we are viewing
  const isOwnProfile = !id || id === currentUser?.id;
  const targetId = isOwnProfile ? currentUser?.id : id;

  const [resolvedUser, setResolvedUser] = useState(null);
  const [sentRequest, setSentRequest] = useState(false);

  // Fetch Stats and Activity Feed
  const { data: stats, isLoading: statsLoading } = useUserStatsQuery(targetId);
  const { data: activityFeed = [], isLoading: feedLoading } =
    useUserFeedQuery(targetId);
  const { data: friends = [] } = useFriendsQuery();
  const { data: pendingRequests = [] } = usePendingRequestsQuery();

  // Search query as fallback if user data is missing (e.g. direct page refresh on foreign profile)
  // We search for users with a generic placeholder (or ID search)
  const { data: searchResults } = useSearchUsersQuery(
    resolvedUser?.username || "a",
  );

  useEffect(() => {
    if (isOwnProfile) {
      setResolvedUser(currentUser);
    } else {
      // Check if user object was passed via react-router state
      if (location.state?.user) {
        setResolvedUser(location.state.user);
      } else {
        // Fallback: search in current friends list
        const friendObj = friends.find((f) => f.id === id);
        if (friendObj) {
          setResolvedUser(friendObj);
        } else if (searchResults?.items) {
          // Fallback search match by ID
          const matched = searchResults.items.find((u) => u.id === id);
          if (matched) {
            setResolvedUser(matched);
          }
        }
      }
    }
  }, [id, isOwnProfile, currentUser, location.state, friends, searchResults]);

  const handleBlockUser = async () => {
    if (!targetId) return;
    if (!confirm("Are you sure you want to block this user?")) return;
    try {
      await blockUserMutation.mutateAsync(targetId);
      toast.success("User blocked successfully");
      navigate("/home");
    } catch (err) {
      toast.error(err.message || "Failed to block user");
    }
  };

  const handleAddFriend = async () => {
    if (!targetId) return;
    try {
      await sendFriendRequestMutation.mutateAsync(targetId);
      setSentRequest(true);
      toast.success("Friend request sent!");
    } catch (err) {
      const errMsg = err.message || "";
      if (
        errMsg.includes("already exists") ||
        err.response?.data?.message?.includes("already exists")
      ) {
        setSentRequest(true);
        toast.info("Friend request already pending.");
      } else {
        toast.error(errMsg || "Failed to send friend request");
      }
    }
  };

  const handleAcceptFriendDirect = async () => {
    if (!targetId) return;
    try {
      const req = pendingRequests.find((r) => r.user.id === targetId);
      if (req) {
        await acceptFriendRequestMutation.mutateAsync(req.id);
        toast.success("Friend request accepted!");
      }
    } catch (err) {
      toast.error(err.message || "Failed to accept friend request");
    }
  };

  const isLoading = statsLoading || feedLoading;

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

  const profileUser = resolvedUser || currentUser;
  if (!profileUser) {
    return (
      <div className="text-center py-20 font-medium text-muted-foreground">
        User citizen profile not found in directory.
      </div>
    );
  }

  const isFriend = friends.some((f) => f.id === targetId);

  return (
    <div className="w-full space-y-8 pb-10 font-sans">
      <Card className="overflow-hidden border-border/50 rounded-[40px] shadow-sm bg-card animate-in fade-in duration-500">
        {/* Banner with Red Gradient */}
        <div className="h-48 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-800 relative" />

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
              />
            </div>

            {/* Action buttons (block/add friend for foreign profile) */}
            {!isOwnProfile && (
              <div className="mt-24 flex gap-2">
                {isFriend ? (
                  <Button
                    disabled
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-green-500/10 text-green-500 border border-green-500/20"
                  >
                    Friends
                  </Button>
                ) : pendingRequests.some((r) => r.user.id === targetId) ? (
                  <Button
                    onClick={handleAcceptFriendDirect}
                    className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-10 px-5 bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                  >
                    Accept Request
                  </Button>
                ) : sentRequest ? (
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
        </Tabs>
      </div>
    </div>
  );
}
export default UserProfile;
