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
  Lock,
  Unlock,
  MoreVertical,
  LogOut,
  Check,
  Trash2,
  Archive,
  Users,
  Bold,
  Italic,
  Code,
  Quote,
  Link2,
} from "lucide-react";

import { Avatar } from "@/components/shared/Avatar";
import { MessageCard } from "@/components/shared/MessageCard";
import { RoomCard } from "@/components/shared/RoomCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import {
  useRooms,
  usePendingMembersQuery,
  useAcceptJoinMutation,
  useDeleteRoomMutation,
  useArchiveRoomMutation,
  useUpdateRoomMutation,
} from "@/hooks/useRooms";
import { useMessagesQuery, useSendMessageMutation } from "@/hooks/useMessages";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { getSocket } from "@/services/socketService";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

function PendingRequestsList({ roomId }) {
  const { data: pendingMembers = [], isLoading } = usePendingMembersQuery(roomId);
  const acceptJoinMutation = useAcceptJoinMutation(roomId);

  const handleAccept = async (userId) => {
    try {
      await acceptJoinMutation.mutateAsync(userId);
      toast.success("User admitted to the room!");
    } catch (err) {
      toast.error(err.message || "Failed to admit user");
    }
  };

  if (isLoading) {
    return <div className="text-[10px] text-muted-foreground px-2">Loading requests...</div>;
  }

  if (pendingMembers.length === 0) {
    return <div className="text-[10px] text-muted-foreground px-2 font-medium">No pending requests.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingMembers.map((member) => (
        <div key={member.id} className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-2xl border border-border/50">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={member.name || member.username} src={member.avatar} size="xs" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-foreground truncate">{member.name || member.username}</p>
              <p className="text-[9px] text-muted-foreground truncate">@{member.username}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => handleAccept(member.id)}
            className="w-full h-7 rounded-xl font-bold text-[9px] uppercase tracking-wider cursor-pointer"
          >
            Admit
          </Button>
        </div>
      ))}
    </div>
  );
}

// Client-side tree builder to organize flat chronological messages into threads
const buildMessageTree = (flatMessages) => {
  if (!flatMessages || flatMessages.length === 0) return [];
  const messageMap = {};
  
  // Create deep copies to avoid mutating React Query cache data
  flatMessages.forEach((msg) => {
    messageMap[msg.id] = { ...msg, replies: [] };
  });

  const rootMessages = [];
  
  flatMessages.forEach((msg) => {
    const mappedMsg = messageMap[msg.id];
    if (msg.parentId && messageMap[msg.parentId]) {
      messageMap[msg.parentId].replies.push(mappedMsg);
    } else {
      rootMessages.push(mappedMsg);
    }
  });

  return rootMessages;
};

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

  const { data: messages = [], isLoading: messagesLoading } =
    useMessagesQuery(roomId);
  const sendMessageMutation = useSendMessageMutation(roomId);

  const deleteRoomMutation = useDeleteRoomMutation();
  const archiveRoomMutation = useArchiveRoomMutation();
  const updateRoomMutation = useUpdateRoomMutation();

  const handleDeleteRoom = async () => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete this room? This action cannot be undone."
      )
    ) {
      try {
        await deleteRoomMutation.mutateAsync(room.id);
        toast.success("Room deleted successfully");
        navigate("/home");
      } catch (err) {
        toast.error(err.message || "Failed to delete room");
      }
    }
  };

  const handleArchiveRoom = async () => {
    const action = room.archived ? "unarchive" : "archive";
    if (window.confirm(`Are you sure you want to ${action} this room?`)) {
      try {
        await archiveRoomMutation.mutateAsync(room.id);
        toast.success(`Room ${action}d successfully`);
      } catch (err) {
        toast.error(err.message || `Failed to ${action} room`);
      }
    }
  };

  const handleTogglePrivacy = async () => {
    const nextPrivate = !room.isPrivate;
    const action = nextPrivate ? "private" : "public";
    try {
      await updateRoomMutation.mutateAsync({
        roomId: room.id,
        data: { isPrivate: nextPrivate },
      });
      toast.success(`Room is now ${action}`);
    } catch (err) {
      toast.error(err.message || `Failed to make room ${action}`);
    }
  };

  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [activeVoices, setActiveVoices] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Auto-resize composer textarea height
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [messageText]);

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

    // Reset height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
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
    if (e.key === "Enter" && !e.shiftKey) {
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
        const res = await joinRoomMutation.mutateAsync(room.id);
        if (res) {
          setIsJoined(!!res.isJoined);
          if (res.isPending) {
            toast.success("Join request submitted! Awaiting creator approval.");
          } else if (res.isJoined) {
            toast.success("Joined discussion room!");
          }
        } else {
          setIsJoined(true);
          toast.success("Joined discussion room!");
        }
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

  const insertMarkdown = (syntax) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = messageText;
    
    let replacement = "";
    let cursorOffset = 0;

    switch (syntax) {
      case "bold":
        replacement = `**${text.substring(start, end) || "bold text"}**`;
        cursorOffset = text.substring(start, end) ? replacement.length : 11;
        break;
      case "italic":
        replacement = `*${text.substring(start, end) || "italic text"}*`;
        cursorOffset = text.substring(start, end) ? replacement.length : 13;
        break;
      case "code":
        replacement = `\`${text.substring(start, end) || "code"}\``;
        cursorOffset = text.substring(start, end) ? replacement.length : 5;
        break;
      case "quote":
        replacement = `\n> ${text.substring(start, end) || "quote"}\n`;
        cursorOffset = text.substring(start, end) ? replacement.length + 1 : 8;
        break;
      case "link":
        replacement = `[${text.substring(start, end) || "link text"}](https://)`;
        cursorOffset = text.substring(start, end) ? replacement.length : 21;
        break;
      default:
        return;
    }

    const newText = text.substring(0, start) + replacement + text.substring(end);
    setMessageText(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 50);
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

  const isCreator = room.createdBy?.id === currentUser?.id;
  const showPrivateBarrier = room.isPrivate && !isJoined && !isCreator;

  if (showPrivateBarrier) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-full bg-background font-sans p-8 text-center max-w-md mx-auto space-y-6">
        <div className="h-16 w-16 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-full flex items-center justify-center border border-amber-200/50">
          <Lock size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-serif font-black tracking-tight text-foreground">
            This Discussion is Private
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This room requires joining approval from the creator (<strong>{room.createdBy?.username || "creator"}</strong>).
          </p>
        </div>

        {room.isPending ? (
          <Button
            disabled
            className="w-full rounded-full h-12 font-black uppercase text-[10px] tracking-widest border border-amber-200 bg-amber-50/50 text-amber-600 cursor-not-allowed"
          >
            Request Pending Approval
          </Button>
        ) : (
          <Button
            onClick={handleJoinLeaveRoom}
            className="w-full rounded-full h-12 font-black uppercase text-[10px] tracking-widest bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer"
          >
            Request to Join
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="text-xs text-muted-foreground uppercase font-black tracking-widest rounded-full cursor-pointer hover:bg-secondary px-6 h-10"
        >
          Go Back
        </Button>
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

  // Construct message tree for rendering
  const messageTree = buildMessageTree(messages);

  // Right sidebar widgets markup (reused on desktop sidebar & mobile popup dialog)
  const sidebarWidgetsContent = (
    <>
      {isModeratorOrOwner && (
        <div className="p-4 bg-zinc-900 text-white rounded-[20px] border border-neutral-800 space-y-3 relative overflow-hidden dark:bg-[#151515]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-1.5">
            <Pin size={13} className="text-primary animate-pulse" />
            <h4 className="text-[9px] font-black text-primary uppercase tracking-widest font-mono">
              Moderator Directive
            </h4>
          </div>
          <p className="text-[11px] font-serif italic leading-relaxed relative z-10 text-white/90">
            "Focus on policy implications rather than partisan rhetoric. This
            room is being actively moderated for constructive debate."
          </p>
        </div>
      )}

      {/* Active Voices */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-2">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] font-mono">
            Active Voices
          </h3>
          <span className="text-[9px] font-black text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/5 rounded-md border border-primary/10">
            {activeVoices.length} online
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {activeVoices.slice(0, 16).map((u) => (
            <div key={u.id} className="group relative">
              <Avatar
                src={u.avatar}
                name={u.username}
                size="sm"
                status="online"
                showStatus
                className="ring-2 ring-transparent group-hover:ring-primary/20 transition-all cursor-pointer rounded-xl hover:scale-105"
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-xl z-50 uppercase tracking-wider border border-border">
                @{u.username}
              </div>
            </div>
          ))}
          {activeVoices.length === 0 && (
            <p className="text-xs text-muted-foreground italic font-medium">
              Quiet hours. Be the first to speak.
            </p>
          )}
        </div>
      </div>

      {/* Pulse Metrics */}
      <div className="p-6 bg-secondary/35 rounded-[24px] border border-border/40 space-y-4">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-foreground/80" />
          <h3 className="text-[11px] font-black text-foreground uppercase tracking-wider font-mono">
            Discussion Pulse
          </h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              <span>Heat score</span>
              <span className="text-primary font-mono">85%</span>
            </div>
            <div className="h-1 bg-border/50 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[85%] rounded-full animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-2.5 bg-card/65 rounded-xl border border-border/30">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                Takes
              </span>
              <p className="text-xl font-bold text-foreground mt-0.5 font-mono">
                {messages.length}
              </p>
            </div>
            <div className="p-2.5 bg-card/65 rounded-xl border border-border/30">
              <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                Impact
              </span>
              <p className="text-xl font-bold text-foreground mt-0.5 font-mono">
                {messages.length * 3}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hashtags */}
      {roomTags.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] font-mono">
            Keywords
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {roomTags.map((tag, idx) => (
              <button
                key={idx}
                onClick={() => navigate(`/discover?q=${encodeURIComponent(tag)}`)}
                className="px-2.5 py-1 bg-secondary/50 text-secondary-foreground text-[10px] font-bold rounded-lg border border-border/30 hover:bg-foreground hover:text-background transition-all cursor-pointer"
              >
                #{tag.replace(/^#/, "")}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex-grow flex overflow-hidden bg-background h-full font-sans">
      {/* Left Navigation */}
      <aside className="hidden xl:flex flex-col w-42 shrink-0 border-r border-border bg-card">
        <div className="p-5 border-b border-border/90">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="w-full justify-start gap-2.5 rounded-xl hover:bg-secondary font-black uppercase text-[9px] tracking-widest text-muted-foreground cursor-pointer"
          >
            <ChevronLeft size={14} /> Back
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {isCreator && room.isPrivate && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 px-2">
                <Lock size={12} className="text-amber-600 animate-pulse" />
                <h3 className="text-muted-foreground uppercase tracking-[0.2em] text-[9px] font-black font-mono">
                  Admit Queue
                </h3>
              </div>
              <PendingRequestsList roomId={room.id} />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-1.5 px-2">
              <Activity size={12} className="text-primary" />
              <h3 className="text-muted-foreground uppercase tracking-[0.2em] text-[9px] font-black font-mono">
                Trending Discussions
              </h3>
            </div>
            <div className="flex flex-col gap-2">
              {otherTrending.map((r) => (
                <RoomCard
                  key={r.id}
                  room={r}
                  compact
                  onClick={(id) => navigate(`/room/${id}`)}
                  className="bg-transparent hover:bg-secondary/40 rounded-xl p-1.5 transition-colors border border-transparent"
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Discussion Panel */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-card">
        {/* Room Header */}
        <header className="px-6 py-5 border-b border-border/45 bg-card/85 backdrop-blur-xl sticky top-0 z-20 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="xl:hidden h-8 w-8 bg-secondary rounded-lg cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-[8px] font-black uppercase tracking-widest rounded-md font-mono">
                  {room.category}
                </span>
                <span className="flex items-center gap-1 text-green-500 text-[9px] font-black uppercase tracking-widest">
                  <Activity size={10} className="animate-pulse" />{" "}
                  {room._count?.members || 0} Members
                </span>
              </div>
              <h1 className="text-xl md:text-2xl text-foreground font-bold tracking-tight leading-tight truncate">
                {mainTitle}
              </h1>
              <p className="text-muted-foreground text-xs font-medium max-w-xl line-clamp-1">
                {room.description}
              </p>
            </div>
            
            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Mobile Info Button */}
              <button
                onClick={() => setMobileInfoOpen(true)}
                className="xl:hidden flex items-center justify-center h-9 w-9 bg-secondary hover:bg-secondary/80 text-foreground rounded-full transition-colors cursor-pointer"
                title="Room details"
              >
                <Info size={16} />
              </button>

              {/* Join / Joined Button */}
              {isJoined ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold text-xs h-9 px-4 border-green-200 text-green-600 bg-green-500/5 dark:border-green-900/30 dark:text-green-400 cursor-default"
                  disabled
                >
                  <Check size={12} className="mr-1.5" /> Joined
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleJoinLeaveRoom}
                  className="rounded-full font-bold text-xs h-9 px-4 cursor-pointer"
                >
                  Join Room
                </Button>
              )}

              {/* Vertical Dropdown Options */}
              {(isJoined || isCreator) && (
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-9 w-9 hover:bg-secondary cursor-pointer"
                    >
                      <MoreVertical size={14} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg rounded-xl">
                    {isJoined && (
                      <DropdownMenuItem
                        onClick={handleJoinLeaveRoom}
                        className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer font-medium"
                      >
                        <LogOut size={12} /> Leave Room
                      </DropdownMenuItem>
                    )}

                    {isCreator && (
                      <>
                        <DropdownMenuItem
                          onClick={handleTogglePrivacy}
                          className="flex items-center gap-2 text-xs rounded-lg cursor-pointer text-foreground font-medium"
                        >
                          {room.isPrivate ? (
                            <>
                              <Unlock size={12} /> Make Public
                            </>
                          ) : (
                            <>
                              <Lock size={12} /> Make Private
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={handleArchiveRoom}
                          className="flex items-center gap-2 text-xs rounded-lg cursor-pointer text-foreground font-medium"
                        >
                          <Archive size={12} /> {room.archived ? "Unarchive Room" : "Archive Room"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={handleDeleteRoom}
                          className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer font-bold"
                        >
                          <Trash2 size={12} /> Delete Room
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success("Room link copied to clipboard!");
                }}
                className="rounded-full h-9 w-9 cursor-pointer hover:bg-secondary/80 transition-colors"
                title="Share Room link"
              >
                <Share2 size={15} />
              </Button>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div
          ref={feedRef}
          className="flex-grow overflow-y-auto px-6 py-8 flex flex-col gap-6 bg-zinc-50/50 dark:bg-background"
        >
          <div className="space-y-6 max-w-4xl mx-auto w-full">
            {isCreator && room.isPrivate && (
              <div className="xl:hidden block mb-4 p-4 bg-amber-50/20 border border-amber-200/40 rounded-2xl">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <Lock size={12} className="text-amber-600 animate-pulse" />
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-700 font-mono">
                    Admit Queue
                  </h4>
                </div>
                <PendingRequestsList roomId={room.id} />
              </div>
            )}

            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Activity
                  className="animate-spin text-primary mb-3"
                  size={24}
                />
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse font-mono">
                  Retrieving Takes...
                </span>
              </div>
            ) : messageTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground text-center space-y-2">
                <Users size={32} className="opacity-30" />
                <p className="text-sm font-bold text-foreground/80">No takes shared yet.</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Be the first to share your stance and kick off the discussion!
                </p>
              </div>
            ) : (
              messageTree.map((msg) => (
                <div key={msg.id} className="animate-in fade-in duration-300">
                  <MessageCard
                    message={msg}
                    onReply={handleReply}
                    currentUserId={currentUser?.id || ""}
                    depth={0}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Composition Area */}
        <div className="p-4 bg-card border-t border-border/45">
          <div className="max-w-4xl mx-auto space-y-3">
            {replyingTo && (
              <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 overflow-hidden animate-in slide-in-from-bottom-2">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <Award size={12} /> Replying to @{replyingTo.name}
                </span>
                <button
                  className="h-5 w-5 hover:bg-primary/10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                  onClick={() => setReplyingTo(null)}
                  title="Cancel reply"
                >
                  <X size={12} className="text-primary" />
                </button>
              </div>
            )}

            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="text-[9px] text-muted-foreground/80 font-black uppercase tracking-wider pl-3 flex items-center gap-1.5 font-mono">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
                {typingUsers.join(", ")}{" "}
                {typingUsers.length === 1 ? "is" : "are"} typing...
              </div>
            )}

            {/* Premium Composer Box */}
            <div className="bg-secondary/40 border border-border/60 rounded-2xl focus-within:border-primary/30 focus-within:bg-card focus-within:shadow-md transition-all duration-300 overflow-hidden">
              {/* Textarea Input area */}
              <div className="flex items-start gap-3 p-3">
                <div className="hidden sm:block shrink-0 mt-0.5">
                  <Avatar
                    src={currentUser?.avatar}
                    name={currentUser?.username || "You"}
                    size="sm"
                  />
                </div>
                <textarea
                  ref={inputRef}
                  value={messageText}
                  onChange={(e) => {
                    setMessageText(e.target.value);
                    handleTyping();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={replyingTo ? `Write your reply... (Shift + Enter for new lines)` : "Share your stance... (Shift + Enter for new lines)"}
                  rows={2}
                  maxLength={5000}
                  className="flex-grow bg-transparent border-none focus:outline-none resize-none py-1.5 text-sm font-medium placeholder:text-muted-foreground/45 text-foreground leading-relaxed min-h-[40px] max-h-[180px]"
                />
              </div>

              {/* Utility Formatting Bar & Characters counter */}
              <div className="flex items-center justify-between px-3 py-2 bg-secondary/20 border-t border-border/30">
                {/* Editor syntax formatting helpers */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => insertMarkdown("bold")}
                    className="p-1.5 hover:bg-secondary/70 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
                    title="Insert Bold"
                  >
                    <Bold size={13} />
                  </button>
                  <button
                    onClick={() => insertMarkdown("italic")}
                    className="p-1.5 hover:bg-secondary/70 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
                    title="Insert Italic"
                  >
                    <Italic size={13} />
                  </button>
                  <button
                    onClick={() => insertMarkdown("code")}
                    className="p-1.5 hover:bg-secondary/70 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
                    title="Insert Code block"
                  >
                    <Code size={13} />
                  </button>
                  <button
                    onClick={() => insertMarkdown("quote")}
                    className="p-1.5 hover:bg-secondary/70 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
                    title="Insert Blockquote"
                  >
                    <Quote size={13} />
                  </button>
                  <button
                    onClick={() => insertMarkdown("link")}
                    className="p-1.5 hover:bg-secondary/70 rounded-lg text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors"
                    title="Insert Hyperlink"
                  >
                    <Link2 size={13} />
                  </button>
                </div>

                {/* Right controls: Counter and send button */}
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "text-[10px] font-black font-mono tracking-wider",
                    messageText.length > 4500 ? "text-red-500 animate-pulse" : "text-muted-foreground/50"
                  )}>
                    {messageText.length}/5000
                  </span>
                  
                  <Button
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                    size="sm"
                    className="rounded-xl h-8 px-4 font-black uppercase text-[9px] tracking-widest cursor-pointer shadow-sm hover:shadow transition-all"
                  >
                    Send <Send size={10} className="ml-1.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Intelligence (Right Sidebar) - Desktop Only */}
      <aside className="hidden xl:flex flex-col w-64 shrink-0 border-l border-border/90 bg-card p-6 space-y-8 overflow-y-auto">
        {sidebarWidgetsContent}
      </aside>

      {/* Mobile Drawer/Modal for Room Details & Widgets */}
      <Dialog open={mobileInfoOpen} onOpenChange={setMobileInfoOpen}>
        <DialogContent className="rounded-[24px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg">Discussion Room Details</DialogTitle>
            <DialogDescription className="text-xs">
              View active users, tags, metrics, and room descriptions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest font-mono">About Room</span>
              <p className="text-xs font-semibold text-foreground/80 leading-relaxed bg-secondary/30 p-3 rounded-xl border border-border/30">
                {room.description}
              </p>
            </div>
            {sidebarWidgetsContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DiscussionRoom;
