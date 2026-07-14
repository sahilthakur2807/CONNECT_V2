import { useState, useRef, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import {
  PaperAirplaneIcon,
  ChevronLeftIcon,
  MapPinIcon,
  XMarkIcon,
  ShareIcon,
  ArrowPathIcon,
  TrophyIcon,
  InformationCircleIcon,
  LockClosedIcon,
  LockOpenIcon,
  EllipsisVerticalIcon,
  ArrowRightOnRectangleIcon,
  CheckIcon,
  TrashIcon,
  ArchiveBoxIcon,
  UsersIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

import { Avatar } from "@/components/shared/Avatar";
import { MessageCard } from "@/components/shared/MessageCard";
import { Button } from "@/components/ui/button";
import { buildMessageTree } from "@/utils/tree";
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
import { apiClient } from "@/services/apiClient";
import { ImageCropper } from "@/components/ui/ImageCropper";
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
            <Avatar name={member.name || member.username} src={member.avatar} size="xs" userId={member.id} />
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

// Helper to check for actual visible text content (ignores zero-width/invisible Unicode spaces and Braille blank spaces)
const hasVisibleContent = (text) => {
  if (!text) return false;
  // Remove normal whitespaces, zero-width chars, formatting symbols, and Braille blanks
  const cleaned = text
    .replace(/[\s\u200B-\u200D\uFEFF\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\u2800]/g, "")
    .replace(/\p{Z}/gu, "")
    .replace(/\p{C}/gu, "");
  return cleaned.length > 0;
};


export function DiscussionRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const {
    useRoomQuery,
    joinRoomMutation,
    leaveRoomMutation,
  } = useRooms();
  const { data: room, isLoading: roomLoading } = useRoomQuery(roomId);


  const isActualModeratorOrAdmin =
    currentUser &&
    ["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(currentUser.role);

  const { data: messages = [], isLoading: messagesLoading } =
    useMessagesQuery(roomId);
  const sendMessageMutation = useSendMessageMutation(roomId);

  // Construct message tree for rendering (unconditionally at hook level)
  const messageTree = useMemo(() => buildMessageTree(messages), [messages]);

  // Construct roomTags from room.tags (unconditionally at hook level)
  const roomTags = useMemo(() => {
    const rawTags = room?.tags || [];
    const splitTags = [];
    rawTags.forEach((tag) => {
      const parts = tag
        .replace(/#/g, " ")
        .split(/[\s,]+/)
        .map((p) => p.trim())
        .filter(Boolean);
      splitTags.push(...parts);
    });
    return Array.from(new Set(splitTags));
  }, [room?.tags]);

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

  const openBannerModal = () => {
    if (room?.imageUrl) {
      if (room.imageUrl.startsWith("gradient:")) {
        setSelectedBannerPreset(room.imageUrl);
        setCustomBannerPreview("");
      } else {
        setCustomBannerPreview(room.imageUrl);
        setSelectedBannerPreset("");
      }
    } else {
      setSelectedBannerPreset("");
      setCustomBannerPreview("");
    }
    setCustomBannerFile(null);
    setPendingBannerFile(null);
    setIsBannerModalOpen(true);
  };

  const handleUpdateBanner = async () => {
    setIsUpdatingBanner(true);
    const updateToast = toast.loading("Updating room banner...");
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

      await updateRoomMutation.mutateAsync({
        roomId: room.id,
        data: { imageUrl: finalImageUrl },
      });

      setIsBannerModalOpen(false);
      setCustomBannerFile(null);
      setCustomBannerPreview("");
      setSelectedBannerPreset("");
      setPendingBannerFile(null);
      toast.success("Room banner updated successfully!", { id: updateToast });
    } catch (err) {
      toast.error(err.message || "Failed to update room banner", { id: updateToast });
    } finally {
      setIsUpdatingBanner(false);
    }
  };

  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [selectedBannerPreset, setSelectedBannerPreset] = useState("");
  const [customBannerFile, setCustomBannerFile] = useState(null);
  const [customBannerPreview, setCustomBannerPreview] = useState("");
  const [pendingBannerFile, setPendingBannerFile] = useState(null);
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);

  const [messageText, setMessageText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [isJoined, setIsJoined] = useState(false);
  const [activeVoices, setActiveVoices] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  
  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

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
    
    const joinRoom = () => {
      socket.emit("chat.room.joined", { roomId });
    };

    // Join initially
    joinRoom();

    // Rejoin on connection recovery / reconnection
    socket.on("connect", joinRoom);

    // Custom stats/active users updates
    const handleActiveUsersUpdate = (data) => {
      if (data && data.roomId === roomId) {
        setActiveVoices(data.activeUsers || []);
      }
    };
    socket.on("room_active_users_update", handleActiveUsersUpdate);

    return () => {
      socket.emit("chat.room.left", { roomId });
      socket.off("connect", joinRoom);
      socket.off("room_active_users_update", handleActiveUsersUpdate);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current) {
        socket.emit("chat.typing.stopped", { roomId });
      }
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
    if (!hasVisibleContent(messageText) || !currentUser || !roomId) return;
    const text = messageText.trim();

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
      if (error.message?.includes("restricted from sending messages to this room")) {
        setShowRestrictionModal(true);
      } else {
        toast.error(error.message || "Failed to publish take");
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (hasVisibleContent(messageText)) {
        handleSend();
      }
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
    
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("chat.typing.started", { roomId });
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("chat.typing.stopped", { roomId });
      isTypingRef.current = false;
    }, 2000);
  };


  if (roomLoading) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-64 bg-background">
        <ArrowPathIcon className="animate-spin text-primary w-8 h-8" />
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

  const isCreator =
    room?.createdBy?.id === currentUser?.id ||
    (currentUser && ["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(currentUser.role));
  const showPrivateBarrier = room.isPrivate && !isJoined && !isCreator;

  if (showPrivateBarrier) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-full bg-background font-sans p-8 text-center max-w-md mx-auto space-y-6">
        <div className="h-16 w-16 bg-amber-50 dark:bg-amber-950/20 text-amber-600 rounded-full flex items-center justify-center border border-amber-200/50">
          <LockClosedIcon className="w-8 h-8" />
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


  const titleParts = room.title
    .split(/::|\||—/)
    .map((s) => s.trim())
    .filter(Boolean);
  const mainTitle = titleParts[0] || room.title;


  // Right sidebar widgets markup (reused on desktop sidebar & mobile popup dialog)
  const sidebarWidgetsContent = (
    <>
      {isActualModeratorOrAdmin && (
        <div className="p-4 bg-zinc-900 text-white rounded-[20px] border border-neutral-800 space-y-3 relative overflow-hidden dark:bg-[#151515]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
          <div className="flex items-center gap-1.5">
            <MapPinIcon className="w-3.5 h-3.5 text-primary animate-pulse" />
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
                userId={u.id}
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
          <InformationCircleIcon className="w-3.5 h-3.5 text-foreground/80" />
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
            HASHTAGS
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
      <aside className="hidden xl:flex flex-col w-50 shrink-0 border-r border-border bg-card">
        <div className="p-5 border-b border-border/90">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="w-full justify-start gap-2.5 rounded-xl hover:bg-secondary font-black uppercase text-[9px] tracking-widest text-muted-foreground cursor-pointer"
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" /> Back
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-8">
          {isCreator && room.isPrivate && (
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 px-2">
                <LockClosedIcon className="w-3 h-3 text-amber-600 animate-pulse" />
                <h3 className="text-muted-foreground uppercase tracking-[0.2em] text-[9px] font-black font-mono">
                  Admit Queue
                </h3>
              </div>
              <PendingRequestsList roomId={room.id} />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-1.5 px-2">
              <BoltIcon className="w-3 h-3 text-primary" />
              <h3 className="text-muted-foreground uppercase tracking-[0.2em] text-[9px] font-black font-mono">
                Recommended Discussions
              </h3>
            </div>
            <div className="text-[11px] text-muted-foreground/80 italic px-2 font-semibold">
              This option will be available soon
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
                  <ChevronLeftIcon className="w-4 h-4" />
                </Button>
                <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-[8px] font-black uppercase tracking-widest rounded-md font-mono">
                  {room.category}
                </span>
                <span className="flex items-center gap-1 text-green-500 text-[9px] font-black uppercase tracking-widest">
                  <BoltIcon className="w-2.5 h-2.5 animate-pulse" />{" "}
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
                <InformationCircleIcon className="w-4 h-4" />
              </button>

              {/* Join / Joined Button */}
              {isJoined ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full font-bold text-xs h-9 px-4 border-green-200 text-green-600 bg-green-500/5 dark:border-green-900/30 dark:text-green-400 cursor-default"
                  disabled
                >
                  <CheckIcon className="w-3 h-3 mr-1.5" /> Joined
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
                      <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 bg-card border border-border shadow-lg rounded-xl">
                    {isJoined && !isCreator && (
                      <DropdownMenuItem
                        onClick={handleJoinLeaveRoom}
                        className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer font-medium"
                      >
                        <ArrowRightOnRectangleIcon className="w-3 h-3" /> Leave Room
                      </DropdownMenuItem>
                    )}

                    {isCreator && (
                      <>
                        <DropdownMenuItem
                          onClick={openBannerModal}
                          className="flex items-center gap-2 text-xs rounded-lg cursor-pointer text-foreground font-medium"
                        >
                          <PhotoIcon className="w-3 h-3" /> Update Banner
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleTogglePrivacy}
                          className="flex items-center gap-2 text-xs rounded-lg cursor-pointer text-foreground font-medium"
                        >
                          {room.isPrivate ? (
                            <>
                              <LockOpenIcon className="w-3 h-3" /> Make Public
                            </>
                          ) : (
                            <>
                              <LockClosedIcon className="w-3 h-3" /> Make Private
                            </>
                          )}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={handleArchiveRoom}
                          className="flex items-center gap-2 text-xs rounded-lg cursor-pointer text-foreground font-medium"
                        >
                          <ArchiveBoxIcon className="w-3 h-3" /> {room.archived ? "Unarchive Room" : "Archive Room"}
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={handleDeleteRoom}
                          className="flex items-center gap-2 text-xs text-red-600 focus:text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg cursor-pointer font-bold"
                        >
                          <TrashIcon className="w-3 h-3" /> Delete Room
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
                <ShareIcon className="w-[15px] h-[15px]" />
              </Button>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div
          ref={feedRef}
          className="flex-grow overflow-y-auto px-6 py-8 flex flex-col gap-1 bg-zinc-50/50 dark:bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="max-w-4xl mx-auto w-full">
            {isCreator && room.isPrivate && (
              <div className="xl:hidden block mb-4 p-4 bg-amber-50/20 border border-amber-200/40 rounded-2xl">
                <div className="flex items-center gap-1.5 mb-2.5">
                  <LockClosedIcon className="w-3 h-3 text-amber-600 animate-pulse" />
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-amber-700 font-mono">
                    Admit Queue
                  </h4>
                </div>
                <PendingRequestsList roomId={room.id} />
              </div>
            )}

            {messagesLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ArrowPathIcon
                  className="animate-spin text-primary mb-3 w-6 h-6"
                />
                <span className="text-[10px] font-black uppercase tracking-widest animate-pulse font-mono">
                  Retrieving Takes...
                </span>
              </div>
            ) : messageTree.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-2 text-muted-foreground text-center space-y-2">
                <UsersIcon className="w-8 h-8 opacity-50" />
                <p className="text-sm font-bold text-foreground/80">No takes shared yet.</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Be the first to share your stance and kick off the discussion!
                </p>
              </div>
            ) : (
              messageTree.map((msg, idx) => {
                const prevMsg = idx > 0 ? messageTree[idx - 1] : null;
                const isConsecutive = prevMsg && prevMsg.userId === msg.userId;
                const isLastInGroup = idx === messageTree.length - 1 || messageTree[idx + 1].userId !== msg.userId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "animate-in fade-in duration-300 flex flex-col gap-1.5",
                      idx > 0 && (isConsecutive ? "mt-0.5" : "mt-4")
                    )}
                  >
                    {idx > 0 && !isConsecutive && <div className="border-t border-border/80 w-full mb-1.5" />}
                    <MessageCard
                      message={msg}
                      onReply={handleReply}
                      currentUserId={currentUser?.id || ""}
                      depth={0}
                      isConsecutive={isConsecutive}
                      isLastInGroup={isLastInGroup}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Composition Area */}
        <div className="p-4 bg-card border-t border-border/45">
          <div className="max-w-4xl mx-auto space-y-3">
            {replyingTo && (
              <div className="flex items-center justify-between px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 overflow-hidden animate-in slide-in-from-bottom-2">
                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                  <TrophyIcon className="w-3 h-3" /> Replying to @{replyingTo.name}
                </span>
                <button
                  className="h-5 w-5 hover:bg-primary/10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
                  onClick={() => setReplyingTo(null)}
                  title="Cancel reply"
                >
                  <XMarkIcon className="w-3 h-3 text-primary" />
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
            <div className="bg-secondary/40 border border-border/60 rounded-xl focus-within:border-primary/30 focus-within:bg-card focus-within:shadow-md transition-all duration-300 overflow-hidden">
              {/* Textarea Input area */}
              <div className="flex items-end gap-3 px-3.5 py-2">
                <div className="hidden sm:block shrink-0 mb-1">
                  <Avatar
                    src={currentUser?.avatar}
                    name={currentUser?.username || "You"}
                    size="sm"
                    userId={currentUser?.id}
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
                  rows={1}
                  maxLength={200}
                  className="flex-grow bg-transparent border-none focus:outline-none resize-none py-1.5 text-sm font-medium placeholder:text-muted-foreground/45 text-foreground leading-relaxed min-h-[24px] max-h-[140px]"
                />

                {/* Send Button & Counter */}
                <div className="flex items-center gap-2 shrink-0 mb-0.5">
                  {messageText.length > 0 && (
                    <span className={cn(
                      "text-[9px] font-black font-mono tracking-wider",
                      messageText.length > 180 ? "text-red-500 animate-pulse" : "text-muted-foreground/40"
                    )}>
                      {messageText.length}/200
                    </span>
                  )}

                  <Button
                    onClick={handleSend}
                    disabled={!hasVisibleContent(messageText)}
                    size="icon"
                    className="rounded-xl h-8 w-8 cursor-pointer shadow-sm hover:shadow transition-all flex items-center justify-center shrink-0"
                    title="Send Take"
                  >
                    <PaperAirplaneIcon className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contextual Intelligence (Right Sidebar) - Desktop Only */}
      <aside className="hidden xl:flex flex-col w-78 shrink-0 border-l border-border/90 bg-card p-6 space-y-8 overflow-y-auto">
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

      {/* Update Room Banner Modal */}
      <Dialog open={isBannerModalOpen} onOpenChange={setIsBannerModalOpen}>
        <DialogContent className="rounded-[24px] max-h-[85vh] overflow-y-auto max-w-md w-full">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg font-serif">Update Room Banner</DialogTitle>
            <DialogDescription className="text-xs">
              Select a preset gradient or upload a custom image for the room's cover banner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {pendingBannerFile ? (
              <ImageCropper
                file={pendingBannerFile}
                aspectRatio={3}
                onCropComplete={(croppedFile, croppedUrl) => {
                  setCustomBannerFile(croppedFile);
                  setCustomBannerPreview(croppedUrl);
                  setPendingBannerFile(null);
                }}
                onCancel={() => {
                  setPendingBannerFile(null);
                }}
              />
            ) : (
              <>
                {/* Live Preview */}
                <div className="h-24 w-full rounded-2xl overflow-hidden border border-border/50 relative bg-muted shrink-0 mb-1">
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

                {/* Preset Options & Upload Row */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {[
                    { id: "", name: "Default Image", style: "border-border text-foreground hover:bg-secondary bg-secondary/50" },
                    { id: "gradient:from-red-600 via-red-500 to-red-800", name: "Red", style: "from-red-600 via-red-500 to-red-800 text-white bg-gradient-to-r" },
                    { id: "gradient:from-blue-600 via-indigo-600 to-purple-600", name: "Blue", style: "from-blue-600 via-indigo-600 to-purple-600 text-white bg-gradient-to-r" },
                    { id: "gradient:from-emerald-600 to-teal-800", name: "Teal", style: "from-emerald-600 to-teal-800 text-white bg-gradient-to-r" },
                    { id: "gradient:from-slate-700 via-slate-600 to-slate-800", name: "Slate", style: "from-slate-700 via-slate-600 to-slate-800 text-white bg-gradient-to-r" },
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
                        "h-8 px-3 rounded-xl text-[10px] font-bold cursor-pointer transition-all border-2",
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
                  <label className="h-8 px-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 flex items-center justify-center gap-1.5 text-[10px] font-bold text-foreground cursor-pointer transition-colors">
                    <ArrowUpTrayIcon className="w-3 h-3" />
                    <span>Upload custom banner</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setPendingBannerFile(file);
                        }
                      }}
                    />
                  </label>
                </div>
                
                <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsBannerModalOpen(false)}
                    className="rounded-xl font-bold text-xs h-9 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpdateBanner}
                    disabled={isUpdatingBanner}
                    size="sm"
                    className="rounded-xl font-bold text-xs h-9 px-5 cursor-pointer animate-in fade-in"
                  >
                    {isUpdatingBanner ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Room Restriction Alert Modal */}
      {showRestrictionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-sm w-full p-8 text-center space-y-6 relative shadow-2xl border border-border/50">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
              <LockClosedIcon className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black font-serif">Room Access Restricted</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account has been restricted from sending messages to this room by a platform moderator or administrator due to reported behavior.
              </p>
            </div>
            <button
              onClick={() => setShowRestrictionModal(false)}
              className="w-full py-3 text-xs font-bold uppercase tracking-wider bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-all cursor-pointer border-none"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DiscussionRoom;
