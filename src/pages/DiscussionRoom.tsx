import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
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
  Info
} from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { MessageCard } from '@/components/features/MessageCard';
import { RoomCard } from '@/components/features/RoomCard';
import type { Message } from '@/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/hooks/use-auth';
import { useRoomStore } from '@/store/useRoomStore';
import { useNotificationStore } from '@/store/useNotificationStore';
import { connectSocket, getSocket } from '@/services/socket';

export function DiscussionRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const {
    currentRoom: room,
    messages,
    isLoadingMessages: loading,
    openRoom,
    closeRoom,
    sendMessage,
    addMessage,
    updateMessageInList,
    removeMessageFromList,
    joinRoom,
    leaveRoom
  } = useRoomStore();

  const [trendingRooms, setTrendingRooms] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [activeVoices, setActiveVoices] = useState<any[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize data and WebSocket listeners
  useEffect(() => {
    if (!roomId) return;

    // Load room details and messages from backend
    openRoom(roomId);

    // Fetch auxiliary dashboard stats
    const fetchAuxData = async () => {
      try {
        const trendingRes = await fetch('/api/rooms/trending');
        if (trendingRes.ok) setTrendingRooms(await trendingRes.json());
      } catch (err) {
        console.error('Failed to fetch sidebar data:', err);
      }
    };
    fetchAuxData();

    // Check if user is already a member
    const checkMembership = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (res.ok) {
          await res.json();
          // We assume user is member if they are in the database relation (custom implementation detail check if wanted)
          setIsJoined(true);
        }
      } catch (e) { }
    };
    checkMembership();

    // Setup Socket.IO realtime connection
    connectSocket();
    const socket = getSocket();
    socket.emit('join_room', roomId);

    socket.on('new_message', (msg: Message) => {
      addMessage(msg);
      // Scroll to bottom on new message if feed is at bottom
      setTimeout(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
      }, 100);
    });

    socket.on('update_message', (msg: Message) => {
      updateMessageInList(msg);
    });

    socket.on('delete_message', (id: string) => {
      removeMessageFromList(id);
    });

    socket.on('notification', (notification: any) => {
      useNotificationStore.getState().addNotification(notification);
    });

    const handleActiveUsersUpdate = (usersList: any[]) => {
      setActiveVoices(usersList);
    };
    socket.on('room_active_users_update', handleActiveUsersUpdate);

    return () => {
      socket.emit('leave_room', roomId);
      socket.off('new_message');
      socket.off('update_message');
      socket.off('delete_message');
      socket.off('notification');
      socket.off('room_active_users_update', handleActiveUsersUpdate);
      closeRoom();
    };
  }, [roomId, openRoom, closeRoom, addMessage, updateMessageInList, removeMessageFromList]);

  // Handle message sending
  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !currentUser || !roomId) return;

    // Clear input immediately to prevent double submissions if Enter is pressed twice
    setMessageText('');
    const replyTargetId = replyingTo?.id;
    setReplyingTo(null);

    try {
      await sendMessage(roomId, text, replyTargetId || undefined);
      // Focus back to input
      inputRef.current?.focus();
    } catch (error) {
      // Revert on error
      setMessageText(text);
      console.error('Failed to publish take:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReply = (messageId: string, userName: string) => {
    setReplyingTo({ id: messageId, name: userName });
    inputRef.current?.focus();
  };

  const handleJoinLeaveRoom = async () => {
    if (!roomId) return;
    try {
      if (isJoined) {
        await leaveRoom(roomId);
        setIsJoined(false);
        navigate('/home');
      } else {
        await joinRoom(roomId);
        setIsJoined(true);
      }
    } catch (e) {
      console.error('Failed to toggle room membership:', e);
    }
  };

  if (loading) {
    return <div className="flex-1 flex justify-center items-center bg-background"><Activity className="animate-spin text-primary" /></div>;
  }

  if (!room) {
    return <div className="flex-1 flex justify-center items-center bg-background font-bold text-muted-foreground">Discussion room not found.</div>;
  }

  const otherTrending = trendingRooms.filter((r) => r.id !== room.id).slice(0, 4);

  // Extract main title and tags
  const titleParts = room.title.split(/::|\||—/).map(s => s.trim()).filter(Boolean);
  const mainTitle = titleParts[0] || room.title;
  const roomTags = titleParts.slice(1);

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* ── Left Navigation ── */}
      <aside className="hidden xl:flex flex-col w-72 shrink-0 border-r border-border/50 bg-card">
        <div className="p-6 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="w-full justify-start gap-3 rounded-2xl hover:bg-secondary font-black uppercase text-[10px] tracking-widest text-muted-foreground"
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
                  room={{
                    ...r,
                    memberCount: r._count?.members || 0,
                    messageCount: r._count?.messages || 0,
                    activeNow: Math.ceil((r._count?.members || 1) * 0.4)
                  }}
                  compact
                  onClick={(id) => navigate(`/room/${id}`)}
                  className="bg-transparent hover:bg-secondary rounded-2xl p-2"
                />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Discussion Panel ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative bg-card">
        {/* Room Header */}
        <header className="px-8 py-8 border-b border-border/50 bg-card/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-start justify-between gap-8">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate(-1)}
                  className="xl:hidden h-10 w-10 bg-secondary rounded-full"
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
                  <Activity size={12} className="animate-pulse" /> {room._count?.members || 0} Members
                </span>
              </div>
              <h1
                className="text-3xl md:text-4xl text-foreground tracking-tight leading-tight line-clamp-3"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
              >
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
                  "rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest transition-all",
                  isJoined ? "shadow-xl shadow-primary/20" : "border-2"
                )}
              >
                {isJoined ? 'Joined' : 'Join Discussion'}
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => navigator.clipboard.writeText(window.location.href)}
                className="rounded-full h-12 w-12"
              >
                <Share2 size={18} />
              </Button>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto px-8 py-10 flex flex-col gap-8 bg-background"
        >
          <div className="space-y-8 max-w-5xl mx-auto w-full">
            {/* Pinned Announcement */}
            <div className="mb-10">
              <div className="bg-foreground dark:bg-[#1a1a1a] rounded-[32px] p-8 flex gap-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0 relative z-10">
                  <Pin size={24} className="text-primary" />
                </div>
                <div className="relative z-10 space-y-2">
                  <span className="font-black uppercase text-[10px] tracking-[0.3em] text-primary block">Moderator Directive</span>
                  <p className="text-lg font-medium text-background/90 dark:text-foreground/90 leading-relaxed italic" style={{ fontFamily: "'Georgia', serif" }}>
                    "Focus on policy implications rather than partisan rhetoric. This room is being actively moderated for constructive debate."
                  </p>
                </div>
              </div>
            </div>

            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
              >
                <MessageCard
                  message={msg}
                  onReply={handleReply}
                  currentUserId={currentUser?.id || ''}
                  className="bg-card border border-border/50 shadow-sm rounded-[24px] p-5"
                />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Composition Area */}
        <div className="p-5 bg-card border-t border-border/50">
          <div className="max-w-4xl mx-auto space-y-4">
            <AnimatePresence>
              {replyingTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between px-6 py-3 bg-primary/5 rounded-2xl border border-primary/10 overflow-hidden"
                >
                  <span className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <Award size={14} /> Replying to {replyingTo.name}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 rounded-full" onClick={() => setReplyingTo(null)}>
                    <X size={14} className="text-primary" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2 p-1.5 bg-muted rounded-full border border-border/50 shadow-sm focus-within:border-primary/20 focus-within:shadow-md focus-within:bg-card transition-all">
              <div className="flex items-center gap-1 pl-2">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:bg-secondary">
                  <Smile size={20} />
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:bg-secondary">
                  <Paperclip size={20} />
                </Button>
              </div>

              <input
                ref={inputRef as any}
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown as any}
                placeholder="What is your stance?"
                className="flex-1 bg-transparent border-none focus:outline-none px-4 py-3 text-base font-medium placeholder:text-muted-foreground/40 text-foreground"
              />

              <Button
                onClick={handleSend}
                disabled={!messageText.trim()}
                className="rounded-full px-8 h-11 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20 ml-2"
              >
                Send <Send size={14} className="ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Contextual Intelligence (Right Sidebar) ── */}
      <aside className="hidden 2xl:flex flex-col w-96 shrink-0 border-l border-border/50 bg-card p-8 space-y-10 overflow-y-auto">
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
            {activeVoices.slice(0, 16).map((u: any) => (
              <div key={u.id} className="group relative">
                <Avatar
                  src={u.avatar}
                  name={u.name || u.username}
                  size="sm"
                  status="online"
                  showStatus
                  className="ring-2 ring-transparent group-hover:ring-primary/10 transition-all cursor-pointer rounded-xl"
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-popover text-popover-foreground text-[10px] font-black rounded-xl opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none shadow-2xl z-50 uppercase tracking-widest border border-border">
                  {u.name || u.username}
                </div>
              </div>
            ))}
            {activeVoices.length === 0 && (
              <p className="text-xs text-muted-foreground italic font-medium">No active voices.</p>
            )}
          </div>
        </div>

        <div className="p-8 bg-muted rounded-[40px] border border-border/50 space-y-6">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-foreground" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Discussion Pulse</h3>
          </div>
          <div className="space-y-6">
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
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Takes</span>
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {messages.length || 0}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Impact</span>
                <p className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {(messages.length * 3 || 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {(roomTags.length > 0 || (room.tags && room.tags.length > 0)) && (
          <div className="p-8 bg-card border border-border/50 rounded-[40px] space-y-5 shadow-sm">
            <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Hashtags
            </h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...roomTags, ...(room.tags || [])])).map((tag: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => navigate(`/discover?q=${encodeURIComponent(tag)}`)}
                  className="px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl border border-border shadow-sm hover:bg-foreground hover:text-background transition-all cursor-pointer">#{tag.replace(/^#/, '')}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-8 bg-card border border-border/50 rounded-[40px] space-y-4 shadow-sm">
          <h3 className="text-xs font-black text-foreground uppercase tracking-wider">Reputation at Stake</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            High-quality contributions in this room earn double <strong>Reputation Points</strong> today. Maintain civil discourse for bonus badges.
          </p>
          <Button variant="secondary" className="w-full rounded-2xl h-10 font-black uppercase text-[9px] tracking-[0.2em]">
            Learn More
          </Button>
        </div>
      </aside>
    </div>
  );
}
