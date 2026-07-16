import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  PaperAirplaneIcon,
  ArrowPathIcon,
  UsersIcon,
  LockClosedIcon,
  ChevronLeftIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";
import { buildMessageTree } from "@/utils/tree";
import { Avatar } from "@/components/shared/Avatar";
import { MessageCard } from "@/components/shared/MessageCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRooms } from "@/hooks/useRooms";
import { useMessagesQuery, useSendMessageMutation } from "@/hooks/useMessages";
import { useSocketEvents } from "@/hooks/useSocketEvents";
import { getSocket } from "@/services/socketService";
import { cn } from "@/utils/cn";


export function WorldChatPage() {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const { useRoomsQuery, createRoomMutation } = useRooms();
  const { data: rooms = [], isLoading: roomsLoading } = useRoomsQuery({ limit: 100, includeWorldChat: true });

  const [worldChatRoomId, setWorldChatRoomId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [activeUsers, setActiveUsers] = useState([]);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);

  const feedRef = useRef(null);
  const inputRef = useRef(null);
  const cooldownIntervalRef = useRef(null);

  // 1. Resolve or Auto-Create the global "World Chat" room
  useEffect(() => {
    if (roomsLoading || isCreating || worldChatRoomId) return;
    const worldRoom = rooms.find((r) => r.title === "World Chat");
    if (worldRoom) {
      setWorldChatRoomId(worldRoom.id);
    } else {
      setIsCreating(true);
      createRoomMutation.mutate(
        {
          title: "World Chat",
          description: "Global chat room for citizens across the network.",
          category: "All Topics",
          tags: ["world", "global", "chat"],
        },
        {
          onSuccess: (newRoom) => {
            setWorldChatRoomId(newRoom.id);
            setIsCreating(false);
          },
          onError: (err) => {
            console.error("Failed to create World Chat room", err);
            setIsCreating(false);
          },
        }
      );
    }
  }, [rooms, roomsLoading, isCreating, worldChatRoomId, createRoomMutation]);

  // 2. Fetch messages & mutation for the resolved World Chat room
  const { data: messages = [], isLoading: messagesLoading } =
    useMessagesQuery(worldChatRoomId);
  const sendMessageMutation = useSendMessageMutation(worldChatRoomId);

  // Auto-scroll messages feed
  useEffect(() => {
    if (messages.length > 0 && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, messagesLoading]);

  // Socket event subscription for real-time messages
  useSocketEvents(worldChatRoomId, {
    onMessageCreated: () => {
      setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, 100);
    },
    onRoomActiveUsersUpdate: (data) => {
      if (data && data.roomId === worldChatRoomId) {
        setActiveUsers(data.activeUsers || []);
      }
    },
  });

  // Socket channel joining and active users tracking
  useEffect(() => {
    if (!worldChatRoomId) return;
    const socket = getSocket();
    
    const handleConnect = () => {
      socket.emit("chat.room.joined", { roomId: worldChatRoomId });
    };

    socket.emit("chat.room.joined", { roomId: worldChatRoomId });
    socket.on("connect", handleConnect);

    return () => {
      socket.emit("chat.room.left", { roomId: worldChatRoomId });
      socket.off("connect", handleConnect);
    };
  }, [worldChatRoomId]);

  // 3. Restriction Check Calculations (Signin, >= 5 joined groups, >= 10 days old account)
  const joinedRoomsCount = useMemo(() => {
    return rooms.filter((r) => r.isJoined).length;
  }, [rooms]);

  const accountAgeDays = useMemo(() => {
    if (!currentUser?.createdAt) return 0;
    const diffTime = Math.abs(new Date() - new Date(currentUser.createdAt));
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [currentUser]);

  /*
    ===========================================================================
    ACCESS RESTRICTIONS TOGGLE:
    To activate the restriction checks, UNCOMMENT the line below (Line 145),
    and COMMENT OUT the subsequent line (Line 146).
    ===========================================================================
  */
  // const isAccessRestricted = joinedRoomsCount < 5 || accountAgeDays <= 10;
  const isAccessRestricted = false;

  // 4. Cooldown / Rate Limit timer handling (30s)
  useEffect(() => {
    const expiry = localStorage.getItem("world_chat_cooldown_expiry");
    if (expiry) {
      const remaining = Math.ceil((parseInt(expiry) - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownRemaining(remaining);
        startCooldownTimer(remaining);
      } else {
        localStorage.removeItem("world_chat_cooldown_expiry");
      }
    }
    return () => {
      if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    };
  }, []);

  const startCooldownTimer = (initialSeconds) => {
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    let secondsLeft = initialSeconds;
    cooldownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        setCooldownRemaining(0);
        localStorage.removeItem("world_chat_cooldown_expiry");
        clearInterval(cooldownIntervalRef.current);
      } else {
        setCooldownRemaining(secondsLeft);
      }
    }, 1000);
  };

  const handleSend = async () => {
    if (!messageText.trim() || isAccessRestricted || cooldownRemaining > 0) return;
    const text = messageText.trim();
    setMessageText("");

    try {
      await sendMessageMutation.mutateAsync({
        content: text,
        parentId: null,
        category: "World Affairs",
      });

      // Start 30 seconds rate-limit cooldown
      const expiryTime = Date.now() + 30000;
      localStorage.setItem("world_chat_cooldown_expiry", expiryTime.toString());
      setCooldownRemaining(30);
      startCooldownTimer(30);

      setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, 100);
    } catch (err) {
      setMessageText(text);
      if (err.message?.includes("restricted from sending messages to this room")) {
        setShowRestrictionModal(true);
      } else {
        toast.error(err.message || "Failed to publish message");
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Construct message tree for rendering
  const messageTree = useMemo(() => buildMessageTree(messages), [messages]);

  // Loading States
  const loading = roomsLoading || isCreating || (worldChatRoomId && messagesLoading);
  if (loading) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center h-64 bg-background">
        <ArrowPathIcon className="animate-spin text-primary w-8 h-8" />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
          Connecting to World Chat...
        </p>
      </div>
    );
  }

  // Access Restricted View
  if (isAccessRestricted) {
    return (
      <div className="flex-grow flex flex-col justify-center items-center py-20 px-6 font-sans text-center bg-background min-h-[70vh]">
        <div className="max-w-md w-full bg-card border border-border/80 rounded-[32px] p-8 shadow-sm space-y-6 animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-3xl flex items-center justify-center mx-auto">
            <LockClosedIcon className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h1
              className="text-2xl font-black text-foreground"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Access Restricted
            </h1>
            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-widest font-mono">
              World Chat Prerequisites
            </p>
          </div>
          <div className="text-left bg-secondary/35 rounded-2xl p-5 space-y-3.5 border border-border/40 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Joined groups (At least 5):</span>
              <span className={cn(
                "font-black font-mono px-2 py-0.5 rounded",
                joinedRoomsCount >= 5 ? "bg-green-150 text-green-700" : "bg-red-50 text-red-600"
              )}>
                {joinedRoomsCount} / 5
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-muted-foreground">Account age (At least 10 days):</span>
              <span className={cn(
                "font-black font-mono px-2 py-0.5 rounded",
                accountAgeDays >= 10 ? "bg-green-150 text-green-700" : "bg-red-50 text-red-600"
              )}>
                {accountAgeDays} / 10 days
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="rounded-full px-6 font-black uppercase text-[10px] tracking-widest cursor-pointer h-11 w-full gap-2 hover:bg-secondary"
          >
            <ChevronLeftIcon className="w-3 h-3" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-border bg-card/85 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg text-foreground font-black tracking-tight font-serif truncate">
                  World Chat
                </h1>
              </div>
              <p className="text-muted-foreground text-[10px] font-medium hidden sm:block">
                Broadcast stance to the network square
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeUsers.length > 0 && (
              <div className="flex -space-x-1.5 overflow-hidden">
                {activeUsers.slice(0, 4).map((u) => (
                  <div key={u.id} className="group relative">
                    <Avatar
                      src={u.avatar}
                      name={u.username}
                      size="xs"
                      className="ring-2 ring-card"
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-[9px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-xl z-50 uppercase tracking-wider border border-border">
                      @{u.username}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-green-600 text-[10px] font-black uppercase tracking-widest font-mono">
              <BoltIcon className="w-2.5 h-2.5 animate-pulse" />
              <span>{activeUsers.length} active</span>
            </div>
          </div>
        </div>  

        {/* Messages Feed Area */}
        <div
          ref={feedRef}
          className="flex-grow overflow-y-auto px-6 py-6 space-y-4 bg-background scrollbar-none"
        >
          {messageTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground text-center space-y-2.5">
              <UsersIcon className="w-9 h-9 opacity-50" />
              <p className="text-sm font-bold text-foreground/80">No statements published yet.</p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                Be the first to address the global square and kickstart the citizen chat!
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
                  {idx > 0 && !isConsecutive && <div className="border-t border-border/70 w-full mb-1.5" />}
                  <MessageCard
                    message={msg}
                    onReply={() => {}}
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

        {/* Message Input Composer */}
        <div className="p-5 border-t border-border bg-card shrink-0">
          <div className="bg-secondary/40 border border-border/60 rounded-xl focus-within:border-primary/30 focus-within:bg-card focus-within:shadow-md transition-all duration-300 overflow-hidden">
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
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  cooldownRemaining > 0
                    ? `Please wait ${cooldownRemaining}s before next stance...`
                    : "Broadcast your stance to the world..."
                }
                disabled={cooldownRemaining > 0}
                rows={1}
                maxLength={200}
                className="flex-grow bg-transparent border-none focus:outline-none resize-none py-1.5 text-sm font-medium placeholder:text-muted-foreground/45 text-foreground leading-relaxed min-h-[24px] max-h-[140px] disabled:opacity-50"
              />

              <div className="flex items-center gap-2 shrink-0 mb-0.5">
                {cooldownRemaining > 0 ? (
                  <span className="text-[10px] font-black font-mono text-amber-600 animate-pulse bg-amber-500/10 px-2 py-0.5 rounded-md">
                    Cooldown {cooldownRemaining}s
                  </span>
                ) : (
                  messageText.length > 0 && (
                    <span className="text-[9px] font-black font-mono text-muted-foreground/40">
                      {messageText.length}/200
                    </span>
                  )
                )}

                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || cooldownRemaining > 0}
                  size="icon"
                  className="rounded-xl h-8 w-8 cursor-pointer shadow-sm hover:shadow transition-all flex items-center justify-center shrink-0"
                  title="Send message"
                >
                  <PaperAirplaneIcon className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
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

export default WorldChatPage;
