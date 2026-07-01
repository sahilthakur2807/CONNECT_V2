import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Send,
  ChevronLeft,
  Pin,
  Smile,
  Paperclip,
  X,
  Share2,
  Activity,
  Award,
  Info,
} from "lucide-react";

import { Avatar } from "@/components/shared/Avatar";
import { MessageCard } from "@/components/shared/MessageCard";
import { RoomCard } from "@/components/shared/RoomCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useMessages } from "@/hooks/useMessages";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";

export function DiscussionRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const {
    useRoomQuery,
    useTrendingRoomsQuery,
    joinRoomMutation,
    leaveRoomMutation,
  } = useRooms();
  const { data: room, isLoading: roomLoading } = useRoomQuery(roomId);
  const { data: trendingRooms = [] } = useTrendingRoomsQuery(5);

  const isModeratorOrOwner =
    currentUser?.role === "moderator" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "superadmin" ||
    (room?.createdBy?.id && room.createdBy.id === currentUser?.id);

  const { useMessagesQuery, sendMessageMutation } = useMessages(roomId);
  const { data: messages = [], isLoading: messagesLoading } =
    useMessagesQuery();

  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [activeVoices, setActiveVoices] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto scroll to bottom when messages load or change
  useEffect(() => {
    if (messages.length > 0 && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, messagesLoading]);

  // Setup Socket.IO realtime connection for joining/leaving the socket room channel
  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();
    socket.emit("chat.room.joined", { roomId });

    // Custom stats/active users updates
    const handleActiveUsersUpdate = (data) => {
      if (data && data.roomId === roomId) {
        setActiveVoices(data.activeUsers || []);
      }
    };
    socket.on("room_active_users_update", handleActiveUsersUpdate);

    return () => {
      socket.emit("chat.room.left", { roomId });
      socket.off("room_active_users_update", handleActiveUsersUpdate);
    };
  }, [roomId]);

  // Setup Real-time typing and message sockets
  useSocketEvents(roomId, {
    onTypingStarted: (data) => {
      if (data.username !== currentUser?.username) {
        setTypingUsers((prev) =>
          prev.includes(data.username) ? prev : [...prev, data.username],
        );
      }
    },
    onTypingStopped: (data) => {
      setTypingUsers((prev) => prev.filter((u) => u !== data.username));
    },
  });

  // Verify room membership
  useEffect(() => {
    if (room) {
      setIsJoined(!!room.isJoined);
    }
  }, [room]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !currentUser || !roomId) return;

    setMessageText("");
    const replyTargetId = replyingTo?.id;
    setReplyingTo(null);

    try {
      // Rebuilt server message composition
      await sendMessageMutation.mutateAsync({
        content: text,
        parentId: replyTargetId || null,
      });
      // Auto scroll
      setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, 100);
      inputRef.current?.focus();
    } catch (error) {
      setMessageText(text);
      toast.error(error.message || "Failed to publish take");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (messageId, userName) => {
    setReplyingTo({ id: messageId, name: userName });
    inputRef.current?.focus();
  };

  const handleJoinLeaveRoom = async () => {
    if (!room) return;
    try {
      if (isJoined) {
        await leaveRoomMutation.mutateAsync(room.id);
        setIsJoined(false);
        toast.info("Left discussion room");
      } else {
        await joinRoomMutation.mutateAsync(room.id);
        setIsJoined(true);
        toast.success("Joined discussion room!");
      }
    } catch (e) {
      toast.error(e.message || "Failed to toggle room membership");
    }
  };

  const handleTyping = () => {
    if (!roomId) return;
    const socket = getSocket();
    socket.emit("chat.typing.started", { roomId });

    // Reset typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat.typing.stopped", { roomId });
    }, 2000);
  };

  if (roomLoading) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-64 bg-background">
        <Activity className="animate-spin text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Loading room details...
        </p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-grow flex justify-center items-center bg-background font-bold text-muted-foreground">
        Discussion room not found.
      </div>
    );
  }

  const otherTrending = trendingRooms
    .filter((r) => r.id !== room.id)
    .slice(0, 4);

  const titleParts = room.title
    .split(/::|\||—/)
    .map((s) => s.trim())
    .filter(Boolean);
  const mainTitle = titleParts[0] || room.title;
  const roomTags = room.tags || [];

  return (
    <div className="flex-grow flex overflow-hidden bg-background h-[calc(100vh-4.5rem)] font-sans">
      {/* Left Navigation */}
      <aside className="hidden xl:flex flex-col w-42 shrink-0 border-r border-border/50 bg-card">
        <div className="p-6 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="w-full justify-start gap-3 rounded-2xl hover:bg-secondary font-black uppercase text-[10px] tracking-widest text-muted-foreground cursor-pointer"
          >
            <ChevronLeft size={16} /> Back
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
              <Activity size={14} className="text-primary" />
              <h3
                className="text-muted-foreground uppercase tracking-[0.2em] text-[10px] font-black"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Hot Now
              </h3>
            </div>
            <div className="flex flex-col gap-4">
              {otherTrending.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  compact
                  onClick={(id) => navigate(`/room/${id}`)}
                  className="bg-transparent hover:bg-secondary rounded-2xl p-2"
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Discussion Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-card">
        {/* Room Header */}
        <header className="px-8 py-8 border-b border-border/50 bg-card/85 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="xl:hidden h-10 w-10 bg-secondary rounded-full cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </Button>
                <span
                  className="text-muted-foreground uppercase tracking-[0.2em] text-[10px] font-black"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {room.category}
                </span>
                <span className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-widest">
                  <Activity size={12} className="animate-pulse" />{" "}
                  {room._count?.members || 0} Members
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl text-foreground tracking-tight leading-tight line-clamp-3 font-serif font-black">
                {mainTitle}
              </h1>
              <p className="text-muted-foreground text-sm max-w-2xl font-medium leading-relaxed">
                {room.description}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <Button
                variant={isJoined ? "default" : "outline"}
                onClick={handleJoinLeaveRoom}
                className={cn(
                  "rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer",
                  isJoined ? "shadow-xl shadow-primary/20" : "border-2",
                )}
              >
                {isJoined ? "Joined" : "Join Discussion"}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Room link copied to clipboard!");
                }}
                className="rounded-full h-12 w-12 cursor-pointer"
              >
                <Share2 size={18} />
              </Button>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div
          ref={feedRef}
          className="flex-grow overflow-y-auto px-8 py-10 flex flex-col gap-8 bg-background"
        >
          <div className="space-y-8 max-w-5xl mx-auto w-full">
            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Activity
                  className="animate-spin text-primary mb-4"
                  size={28}
                />
                <span className="text-xs font-black uppercase tracking-widest animate-pulse">
                  Retrieving Takes...
                </span>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center">
                <p className="text-sm font-semibold">No takes shared yet.</p>
                <p className="text-xs mt-1">
                  Be the first to share your stance below!
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="animate-in fade-in duration-300">
                  <MessageCard
                    message={msg}
                    onReply={handleReply}
                    currentUserId={currentUser?.id || ""}
                    className="bg-card border border-border/50 shadow-sm rounded-[24px] p-5"
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Composition Area */}
        <div className="p-5 bg-card border-t border-border/50">
          <div className="max-w-4xl mx-auto space-y-4">
            {replyingTo && (
              <div className="flex items-center justify-between px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 overflow-hidden animate-in slide-in-from-bottom-2">
                <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                  <Award size={14} /> Replying to @{replyingTo.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 hover:bg-primary/10 rounded-full cursor-pointer"
                  onClick={() => setReplyingTo(null)}
                >
                  <X size={14} className="text-primary" />
                </Button>
              </div>
            )}

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="text-[10px] text-muted-foreground font-black uppercase tracking-wider pl-4 flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            <div className="flex items-center gap-2 p-1.5 bg-muted rounded-full border border-border/50 shadow-sm focus-within:border-primary/20 focus-within:shadow-md focus-within:bg-card transition-all">
              <div className="flex items-center gap-1 pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-10 w-10 text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  <Smile size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-10 w-10 text-muted-foreground hover:bg-secondary cursor-pointer"
                >
                  <Paperclip size={20} />
                </Button>
              </div>

              <input
                ref={inputRef}
                type="text"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
                onKeyDown={handleKeyDown}
                placeholder="What is your stance?"
                className="flex-grow bg-transparent border-none focus:outline-none px-4 py-3 text-base font-medium placeholder:text-muted-foreground/40 text-foreground"
              />

              <Button
                onClick={handleSend}
                disabled={!messageText.trim()}
                className="rounded-full px-8 h-11 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 ml-2 cursor-pointer"
              >
                Send <Send size={14} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Intelligence (Right Sidebar) */}
      <aside className="hidden xl:flex flex-col w-76 shrink-0 border-l border-border/50 bg-card p-8 space-y-10 overflow-y-auto">
        {isModeratorOrOwner && (
          <div className="p-2.5 bg-slate-900 text-white rounded-[24px] border border-border/20 space-y-3 relative overflow-hidden dark:bg-[#1a1a1a]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
            <div className="flex items-center gap-1">
              <Pin size={16} className="text-primary" />
              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">
                Moderator Directive
              </h4>
            </div>
            <p className="text-[11px] font-serif italic leading-relaxed relative z-10 text-white/90">
              "Focus on policy implications rather than partisan rhetoric. This
              room is being actively moderated for constructive debate."
            </p>
          </div>
        )}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Active Voices
            </h3>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest px-2 py-1 bg-primary/5 rounded-md">
              {activeVoices.length} Here
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeVoices.slice(0, 16).map((u) => (
              <div key={u.id} className="group relative">
                <Avatar
                  src={u.avatar}
                  name={u.username}
                  size="sm"
                  status="online"
                  showStatus
                  className="ring-2 ring-transparent group-hover:ring-primary/10 transition-all cursor-pointer rounded-xl"
                />

                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-popover text-popover-foreground text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none shadow-2xl z-50 uppercase tracking-widest border border-border">
                  @{u.username}
                </div>
              </div>
            ))}
            {activeVoices.length === 0 && (
              <p className="text-xs text-muted-foreground italic font-medium">
                No active voices.
              </p>
            )}
          </div>
        </div>

        <div className="p-8 bg-muted rounded-[40px] border border-border/50 space-y-6">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-foreground" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider font-sans">
              Discussion Pulse
            </h3>
          </div>
          <div className="space-y-6 font-sans">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Conversation Heat</span>
                <span className="text-primary">Very High</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[85%] rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Takes
                </span>
                <p className="text-2xl font-black text-foreground font-serif">
                  {messages.length}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  Impact
                </span>
                <p className="text-2xl font-black text-foreground font-serif">
                  {messages.length * 3}
                </p>
              </div>
            </div>
          </div>
        </div>

        {roomTags.length > 0 && (
          <div className="p-8 bg-card border border-border/50 rounded-[40px] space-y-5 shadow-sm">
            <h3
              className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Hashtags
            </h3>
            <div className="flex flex-wrap gap-2">
              {roomTags.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    navigate(`/discover?q=${encodeURIComponent(tag)}`)
                  }
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl border border-border shadow-sm hover:bg-foreground hover:text-background transition-all cursor-pointer"
                >
                  #{tag.replace(/^#/, "")}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
export default DiscussionRoom;
