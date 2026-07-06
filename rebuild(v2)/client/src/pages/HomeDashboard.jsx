import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  Sparkles,
  Flame,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Upload,
} from "lucide-react";
import { RoomCard } from "@/components/shared/RoomCard";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/utils/cn";
import { useRooms } from "@/hooks/useRooms";
import { useSocial } from "@/hooks/useSocial";
import { useDiscovery } from "@/hooks/useDiscovery";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";

const CATEGORIES = [
  "All Topics",
  "Politics",
  "Technology",
  "Economy",
  "Environment",
  "World Affairs",
  "Science",
  "Health",
  "Culture",
  "Sports",
];

export function HomeDashboard() {
  const navigate = useNavigate();
  const activeFriendsRef = useRef(null);
  const { user: currentUser } = useAuth();
  const {
    useTrendingRoomsQuery,
    useHotRoomsQuery,
    useNewRoomsQuery,
    createRoomMutation,
    createCommunityMutation,
    joinRoomMutation,
    leaveRoomMutation,
  } = useRooms();
  const {
    useFriendsQuery,
    usePendingRequestsQuery,
    sendFriendRequestMutation,
    removeFriendMutation,
    acceptFriendRequestMutation,
  } = useSocial();
  const { useSearchUsersQuery } = useDiscovery();

  const [activeTab, setActiveTab] = useState("trending");
  // Friend search states
  const [friendSearchInput, setFriendSearchInput] = useState("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState("");

  // Debounce friend search input to query
  useEffect(() => {
    if (friendSearchInput.length < 2) return;
    const timer = setTimeout(() => {
      setFriendSearchQuery(friendSearchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [friendSearchInput]);

  // Dialog states
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [roomForm, setRoomForm] = useState({
    title: "",
    description: "",
    category: "Politics",
    tags: "",
    sourceUrl: "",
  });
  const [selectedBannerPreset, setSelectedBannerPreset] = useState("");
  const [customBannerFile, setCustomBannerFile] = useState(null);
  const [customBannerPreview, setCustomBannerPreview] = useState("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [communityForm, setCommunityForm] = useState({
    name: "",
    description: "",
    category: "Politics",
  });

  // Sent requests tracker in-memory (resets on load for self-healing status)
  const [sentFriendRequestIds, setSentFriendRequestIds] = useState([]);

  // Fetch pending requests
  const { data: pendingRequests = [] } = usePendingRequestsQuery();

  // Fetch Room Feeds
  const { data: trendingRooms = [], isLoading: trendingLoading } =
    useTrendingRoomsQuery(10, { enabled: activeTab === "trending" });
  const { data: hotRooms = [], isLoading: hotLoading } = useHotRoomsQuery(10, { enabled: activeTab === "hot" });
  const { data: newRooms = [], isLoading: newLoading } = useNewRoomsQuery(10, { enabled: activeTab === "new" });

  // Fetch Friends List (which returns status 'online' or 'offline')
  const { data: friendsList = [], isLoading: friendsLoading } =
    useFriendsQuery();

  // Prune sent requests list if they have become accepted friends
  useEffect(() => {
    if (friendsList.length > 0 && sentFriendRequestIds.length > 0) {
      const next = sentFriendRequestIds.filter(
        (id) => !friendsList.some((f) => f.id === id),
      );
      if (next.length !== sentFriendRequestIds.length) {
        setSentFriendRequestIds(next);
      }
    }
  }, [friendsList, sentFriendRequestIds]);

  // Search Citizens
  const { data: searchResultsData } = useSearchUsersQuery(friendSearchQuery);
  const searchResults = (searchResultsData?.items || []).filter(
    (u) => u.id !== currentUser?.id
  );

  const isLoading =
    trendingLoading || hotLoading || newLoading || friendsLoading;

  const onlineFriends = friendsList.filter((f) => f.status === "online");

  const handleJoinRoom = async (roomId) => {
    try {
      await joinRoomMutation.mutateAsync(roomId);
      toast.success("Joined discussion room");
    } catch (err) {
      toast.error(err.message || "Failed to join room");
    }
  };

  const handleLeaveRoom = async (roomId) => {
    try {
      await leaveRoomMutation.mutateAsync(roomId);
      toast.info("Left discussion room");
    } catch (err) {
      toast.error(err.message || "Failed to leave room");
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomForm.title || !roomForm.category) return;
    setIsUploadingBanner(true);
    try {
      let finalImageUrl = selectedBannerPreset;

      if (customBannerFile) {
        const formData = new FormData();
        formData.append("avatar", customBannerFile);
        const uploadRes = await apiClient.post("/users/avatar", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        finalImageUrl = uploadRes.data.data.url;
      }

      const tagsArray = roomForm.tags
        .replace(/#/g, " ")
        .split(/[\s,]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const newRoom = await createRoomMutation.mutateAsync({
        title: roomForm.title,
        description:
          roomForm.description.trim() ||
          "No description provided for this room.",
        category: roomForm.category,
        tags: tagsArray,
        sourceUrl: roomForm.sourceUrl || undefined,
        imageUrl: finalImageUrl,
      });
      setShowCreateRoom(false);
      setRoomForm({
        title: "",
        description: "",
        category: "Politics",
        tags: "",
        sourceUrl: "",
      });
      setCustomBannerFile(null);
      setCustomBannerPreview("");
      setSelectedBannerPreset("");
      toast.success("Room proposed and launched!");
      navigate(`/room/${newRoom.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    if (!communityForm.name || !communityForm.description) return;
    try {
      await createCommunityMutation.mutateAsync(communityForm);
      setShowCreateCommunity(false);
      setCommunityForm({ name: "", description: "", category: "Politics" });
      toast.success("Sphere established successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to create sphere");
    }
  };

  const handleFriendSearchChange = (val) => {
    setFriendSearchInput(val);
    const isOpen = val.length >= 2;
    setShowSearch(isOpen);
    if (!isOpen) {
      setFriendSearchQuery("");
      setSentFriendRequestIds([]);
    }
  };

  const handleAddFriend = async (friendId) => {
    setAddingFriendId(friendId);
    try {
      await sendFriendRequestMutation.mutateAsync(friendId);
      setSentFriendRequestIds((prev) => {
        if (prev.includes(friendId)) return prev;
        return [...prev, friendId];
      });
      toast.success("Friend request sent!");
      setFriendSearchQuery("");
      setShowSearch(false);
    } catch (err) {
      const errMsg = err.message || "";
      const isAlreadyExists =
        errMsg.includes("already exists") ||
        err.response?.data?.message?.includes("already exists");
      if (isAlreadyExists) {
        setSentFriendRequestIds((prev) => {
          if (prev.includes(friendId)) return prev;
          return [...prev, friendId];
        });
        toast.info("Friend request already pending.");
        setFriendSearchQuery("");
        setShowSearch(false);
      } else {
        toast.error(errMsg || "Failed to send friend request");
      }
    } finally {
      setAddingFriendId("");
    }
  };

  const handleAcceptFriendDirect = async (requestId) => {
    try {
      await acceptFriendRequestMutation.mutateAsync(requestId);
      toast.success("Friend request accepted!");
    } catch (err) {
      toast.error(err.message || "Failed to accept friend request");
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      await removeFriendMutation.mutateAsync(friendId);
      toast.success("Friend removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove friend");
    }
  };

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col justify-center items-center h-64">
        <Activity className="animate-spin text-primary" size={32} />
        <p className="mt-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
          Loading network...
        </p>
      </div>
    );
  }

  const activeRooms =
    activeTab === "trending"
      ? trendingRooms
      : activeTab === "hot"
        ? hotRooms
        : newRooms;

  return (
    <div className="pb-10 w-full space-y-10 ">
      {/* Header */}
      <DashboardHeader
        title="Home"
        description="Your personalized living network of conversations and communities."
        actions={
          <div className="flex gap-2.5">
            <Button
              onClick={() => setShowCreateCommunity(true)}
              className="rounded-xl font-bold border-2 h-10 px-4 cursor-pointer"
            >
              + Sphere
            </Button>
            <Button
              onClick={() => setShowCreateRoom(true)}
              className="rounded-xl font-bold h-10 px-4 cursor-pointer"
            >
              + Room
            </Button>
          </div>
        }
      />

      {/* Active Friends Banner */}
      <div className="space-y-1 bg-card border border-border/50 p-6 rounded-3xl shadow-sm pb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.1em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Friends
            </h3>
            <span
              className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-[0.1em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {onlineFriends.length} Online
            </span>
          </div>

          <div className="flex flex-1 max-w-sm items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="relative">
                <Input
                  placeholder="Add friend by username..."
                  value={friendSearchQuery}
                  onChange={(e) => handleFriendSearchChange(e.target.value)}
                  className="h-8 pr-8 bg-secondary/50 border-none focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-xl text-xs font-bold"
                />

                {friendSearchQuery ? (
                  <button
                    onClick={() => {
                      setFriendSearchQuery("");
                      setShowSearch(false);
                      setSentFriendRequestIds([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <Search
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
                  />
                )}
              </div>

              {/* Search results popover */}
              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-20 mt-2 left-0 right-0 bg-popover border border-border rounded-2xl shadow-xl p-3 space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((u) => {
                    const isAlreadyFriend = friendsList.some(
                      (f) => f.id === u.id,
                    );
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-3 p-1.5 rounded-xl hover:bg-secondary transition-colors"
                      >
                        <div
                          onClick={() => navigate(`/profile/${u.id}`)}
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <img
                            src={u.avatar || undefined}
                            className="w-8 h-8 rounded-full object-cover border border-border"
                            alt=""
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {u.name || u.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              @{u.username}
                            </p>
                          </div>
                        </div>

                        {isAlreadyFriend ? (
                          <span className="text-[9px] font-black uppercase text-green-500 tracking-widest mr-2">
                            Friends
                          </span>
                        ) : pendingRequests.some((r) => r.user.id === u.id) ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const req = pendingRequests.find(
                                (r) => r.user.id === u.id,
                              );
                              if (req) handleAcceptFriendDirect(req.id);
                            }}
                            className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-green-500 bg-green-500/5 hover:bg-green-500 hover:text-white cursor-pointer transition-colors"
                          >
                            Accept
                          </Button>
                        ) : sentFriendRequestIds.includes(u.id) ? (
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mr-2">
                            Sent
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={addingFriendId === u.id}
                            onClick={() => handleAddFriend(u.id)}
                            className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                          >
                            {addingFriendId === u.id ? "Adding..." : "+ Add"}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            {friendsList.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() =>
                    activeFriendsRef.current?.scrollBy({
                      left: -200,
                      behavior: "smooth",
                    })
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Scroll Left"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() =>
                    activeFriendsRef.current?.scrollBy({
                      left: 200,
                      behavior: "smooth",
                    })
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Scroll Right"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {friendsList.length > 0 ? (
          <div
            ref={activeFriendsRef}
            className="flex pt-2 gap-5 overflow-x-auto pb-2 scrollbar-none snap-x"
            style={{ scrollbarWidth: "none" }}
          >
            {friendsList.map((u) => (
              <div
                key={u.id}
                className="flex flex-col items-center gap-2 min-w-[76px] snap-start group cursor-pointer text-center"
                onClick={() => navigate(`/profile/${u.id}`)}
              >
                <div className="relative">
                  <div
                    className={cn(
                      "mt-2 w-14 h-14 rounded-full overflow-hidden border-2 border-card bg-white shadow-sm ring-2 ring-border group-hover:ring-primary/40 transition-all duration-300 group-hover:scale-105 flex items-center justify-center",
                      u.status !== "online" && "opacity-60 grayscale-[30%]",
                    )}
                  >
                    <img
                      src={u.avatar || undefined}
                      alt=""
                    />
                  </div>
                  {u.status === "online" ? (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                  ) : (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-card" />
                  )}
                  {/* Remove friend button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFriend(u.id);
                    }}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md scale-0 group-hover:scale-100 transition-all duration-200 cursor-pointer"
                    title="Remove Friend"
                  >
                    <X size={10} />
                  </button>
                </div>
                <div className="min-w-0 w-full font-sans">
                  <p className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {u.name || u.username}
                  </p>
                  <p className="text-[8px] font-black text-primary uppercase tracking-widest truncate">
                    {u.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground font-medium">
            No friends added yet. Search above to find and add friends!
          </div>
        )}
      </div>

      {/* Debate of the Day Hero Banner */}
      {trendingRooms.length > 0 && (
        <div className="relative bg-foreground rounded-3xl text-background p-8 sm:p-10 overflow-hidden group shadow-xl dark:bg-[#1a1a1a] dark:text-foreground animate-in fade-in duration-500">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px] -mr-32 -mt-32 pointer-events-none" />

          <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
            <div className="space-y-4">
              <div
                className="flex items-center gap-2 text-primary"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "0.15em",
                  fontWeight: 900,
                }}
              >
                <Flame size={14} className="animate-pulse text-primary" />
                DEBATE OF THE DAY
              </div>

              <h2
                className="text-2xl sm:text-3xl lg:text-4xl leading-tight max-w-3xl font-black text-background dark:text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                "{trendingRooms[0].title}"
              </h2>

              <p
                className="text-background/70 dark:text-muted-foreground text-sm max-w-xl line-clamp-2"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.6,
                }}
              >
                {trendingRooms[0].description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-border/20">
              <div className="flex items-center gap-8">
                <div className="space-y-1">
                  <span
                    className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Voices
                  </span>
                  <span
                    className="text-base font-bold text-background dark:text-foreground"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {trendingRooms[0]._count?.members || 0} Citizens
                  </span>
                </div>
                <div className="space-y-1">
                  <span
                    className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Activity
                  </span>
                  <span
                    className="text-base font-bold text-background dark:text-foreground"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    {trendingRooms[0]._count?.messages || 0} Replies
                  </span>
                </div>
              </div>

              <Button
                onClick={() => navigate(`/room/${trendingRooms[0].id}`)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all"
              >
                Branch in →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Tabs Selector */}
      <div className="space-y-8">
        <div className="border-b border-border pb-1 flex items-center justify-between">
          <div className="flex gap-8">
            {[
              {
                id: "trending",
                label: "Trending Feed",
                icon: <TrendingUp size={16} />,
              },
              { id: "hot", label: "Hot Debates", icon: <Flame size={16} /> },
              {
                id: "new",
                label: "Newly Created",
                icon: <Sparkles size={16} />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-4 flex items-center gap-2.5 text-sm font-bold border-b-2 px-1 transition-all relative cursor-pointer",
                  activeTab === tab.id
                    ? "border-primary text-primary font-black"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacious Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {activeRooms.map((room, idx) => (
            <RoomCard
              key={room.id}
              room={room}
              index={idx}
              activeTab={activeTab}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={handleJoinRoom}
              onLeave={handleLeaveRoom}
              className="bg-card border border-border/50 rounded-3xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
            />
          ))}
          {activeRooms.length === 0 && (
            <div className="col-span-full py-20 text-center text-muted-foreground font-medium text-sm">
              No active rooms found under this category. Launch one below!
            </div>
          )}
        </div>
      </div>

      {/* Callout Section */}
      <div className="bg-muted border border-border/50 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h3
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Have a perspective to share?
          </h3>
          <p className="text-xs text-muted-foreground font-medium max-w-md">
            Launch a debate room to discuss news stories, share opinions, or
            host discussions with citizens across the network.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setShowCreateCommunity(true)}
            variant="outline"
            className="rounded-xl font-bold border-2 h-11 px-6 cursor-pointer"
          >
            + Sphere
          </Button>
          <Button
            onClick={() => setShowCreateRoom(true)}
            className="rounded-xl font-bold h-11 px-6 cursor-pointer"
          >
            + Launch Room
          </Button>
        </div>
      </div>

      {/* Create Room Overlay */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-lg w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button
              onClick={() => setShowCreateRoom(false)}
              className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="space-y-1">
              <h2
                className="text-2xl font-black text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Propose a Discussion
              </h2>
              <p className="text-sm text-muted-foreground">
                Create a room to discuss news stories, debates, or ideas.
              </p>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="title"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Room Title
                </label>
                <Input
                  id="title"
                  value={roomForm.title}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, title: e.target.value })
                  }
                  placeholder="e.g. EU AI Act Compliance Models"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="room-desc"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Description
                </label>
                <Textarea
                  id="room-desc"
                  value={roomForm.description}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, description: e.target.value })
                  }
                  placeholder="What is this discussion about? (Optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="room-cat"
                    className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                  >
                    Category
                  </label>
                  <Select
                    value={roomForm.category}
                    onValueChange={(val) =>
                      setRoomForm({ ...roomForm, category: val })
                    }
                  >
                    <SelectTrigger id="room-cat" />
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== "All Topics").map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="room-tags"
                    className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                  >
                    HASHTAGS (Comma or Space separated)
                  </label>
                  <Input
                    id="room-tags"
                    value={roomForm.tags}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, tags: e.target.value })
                    }
                    placeholder="e.g. #war #fire #world"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="room-source"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Article URL (Optional)
                </label>
                <Input
                  id="room-source"
                  value={roomForm.sourceUrl}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, sourceUrl: e.target.value })
                  }
                  placeholder="https://example.com/article"
                  type="url"
                />
              </div>

              {/* Cover Banner Selection */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground block">
                  Select Cover Banner (Optional)
                </label>
                
                {/* Live Preview */}
                <div className="h-20 w-full rounded-2xl overflow-hidden border border-border/50 relative bg-muted shrink-0 mb-3">
                  {customBannerPreview ? (
                    <img src={customBannerPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : selectedBannerPreset ? (
                    <div className={cn(selectedBannerPreset.replace("gradient:", ""), "bg-gradient-to-r w-full h-full")} />
                  ) : (
                    <img src="/room_banner.png" alt="Default Preview" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 left-2 bg-black/40 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded backdrop-blur-xs">
                    Live Preview
                  </div>
                </div>

                {/* Preset Options & Upload Button Row */}
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    { id: "", name: "Default Image", style: "border-border text-foreground hover:bg-secondary bg-secondary/50" },
                    { id: "gradient:from-red-600 via-red-500 to-red-800", name: "Red Gradient", style: "from-red-600 via-red-500 to-red-800 text-white bg-gradient-to-r" },
                    { id: "gradient:from-blue-600 via-indigo-600 to-purple-600", name: "Blue Gradient", style: "from-blue-600 via-indigo-600 to-purple-600 text-white bg-gradient-to-r" },
                    { id: "gradient:from-emerald-600 to-teal-800", name: "Teal Gradient", style: "from-emerald-600 to-teal-800 text-white bg-gradient-to-r" },
                    { id: "gradient:from-slate-700 via-slate-600 to-slate-800", name: "Slate Gradient", style: "from-slate-700 via-slate-600 to-slate-800 text-white bg-gradient-to-r" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedBannerPreset(preset.id);
                        setCustomBannerFile(null);
                        setCustomBannerPreview("");
                      }}
                      className={cn(
                        "h-8 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all border-2",
                        preset.style,
                        !customBannerPreview && selectedBannerPreset === preset.id
                          ? "border-primary ring-2 ring-primary/20 scale-105"
                          : "border-transparent"
                      )}
                    >
                      {preset.name}
                    </button>
                  ))}

                  {/* Upload Image Button */}
                  <label className="h-8 px-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-1.5 text-xs font-bold text-foreground cursor-pointer transition-colors">
                    <Upload size={12} />
                    <span>Upload custom banner</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setCustomBannerFile(file);
                          setCustomBannerPreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isUploadingBanner}
                className="w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest mt-2 cursor-pointer"
              >
                {isUploadingBanner ? "Launching..." : "Launch Room"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Create Community Overlay */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-lg w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button
              onClick={() => setShowCreateCommunity(false)}
              className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={20} />
            </button>
            <div className="space-y-1">
              <h2
                className="text-2xl font-black text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Form a Sphere
              </h2>
              <p className="text-sm text-muted-foreground">
                Establish a brand new community cluster for ideas and articles.
              </p>
            </div>
            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="comm-name"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Community Name
                </label>
                <Input
                  id="comm-name"
                  value={communityForm.name}
                  onChange={(e) =>
                    setCommunityForm({ ...communityForm, name: e.target.value })
                  }
                  placeholder="e.g. Technology & Society"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="comm-desc"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Description
                </label>
                <Textarea
                  id="comm-desc"
                  value={communityForm.description}
                  onChange={(e) =>
                    setCommunityForm({
                      ...communityForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe the topics and rules of this sphere..."
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="comm-cat"
                  className="text-xs font-black uppercase tracking-widest text-muted-foreground"
                >
                  Category
                </label>
                <Select
                  value={communityForm.category}
                  onValueChange={(val) =>
                    setCommunityForm({
                      ...communityForm,
                      category: val,
                    })
                  }
                >
                  <SelectTrigger id="comm-cat" />
                  <SelectContent>
                    {CATEGORIES.filter((c) => c !== "All Topics").map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest mt-2 cursor-pointer"
              >
                Establish Sphere
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default HomeDashboard;
