import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  MessageSquare,
  Flame,
  Sparkles,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/shared/Avatar";
import { cn } from "@/utils/cn";
import { useRooms } from "@/hooks/useRooms";
import { useDiscovery } from "@/hooks/useDiscovery";

export function DiscussionsDashboard() {
  const navigate = useNavigate();
  const scrollRefs = useRef({});

  const {
    useRoomsQuery,
    joinRoomMutation,
    leaveRoomMutation,
  } = useRooms();
  const { useSearchMessagesQuery } = useDiscovery();

  const handleJoinRoom = async (e, roomId) => {
    e.stopPropagation();
    try {
      await joinRoomMutation.mutateAsync(roomId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeaveRoom = async (e, roomId) => {
    e.stopPropagation();
    try {
      await leaveRoomMutation.mutateAsync(roomId);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch all visible rooms
  const { data: rooms = [], isLoading: roomsLoading } = useRoomsQuery({ limit: 100 });

  // Load user selected interests with a fallback set
  const savedInterests = useMemo(() => {
    const raw = localStorage.getItem("selectedInterests");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 4) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse selectedInterests", e);
      }
    }
    return ["Politics", "Technology", "Economy", "Environment"];
  }, []);

  // Map rooms into categories
  const roomsByCategory = useMemo(() => {
    const map = {};
    savedInterests.forEach((cat) => {
      map[cat] = rooms.filter(
        (room) => room.category.toLowerCase() === cat.toLowerCase()
      );
    });
    return map;
  }, [rooms, savedInterests]);

  // Fetch some general takes using the search endpoint with a general query 'a' or 'e' to aggregate messages
  const { data: searchMessagesData, isLoading: messagesLoading } =
    useSearchMessagesQuery("e", 20);
  const messages = searchMessagesData?.items || [];

  const loading = roomsLoading || messagesLoading;

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Loading discussions...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-10 w-full font-sans">
      <DashboardHeader
        title="Live Discussions"
        description="Explore discussions personalized around the interests you selected during onboarding."
      />

      {/* Recommended Category Sliders */}
      {savedInterests.map((cat) => {
        const catRooms = roomsByCategory[cat] || [];
        return (
          <div key={cat} className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary animate-pulse" />
                <h2
                  className="text-xl md:text-2xl font-black text-foreground"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Recommended in {cat}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    scrollRefs.current[cat]?.scrollBy({
                      left: -400,
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
                    scrollRefs.current[cat]?.scrollBy({
                      left: 400,
                      behavior: "smooth",
                    })
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Scroll Right"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div
              ref={(el) => (scrollRefs.current[cat] = el)}
              className="flex gap-6 overflow-x-auto pb-6 pt-2 px-2 snap-x hide-scrollbar scrollbar-none"
              style={{ scrollbarWidth: "none" }}
            >
              {catRooms.map((room) => {
                const isJoined = !!room.isJoined;
                return (
                  <div
                    key={room.id}
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="shrink-0 w-[380px] snap-center bg-card border-2 border-transparent hover:border-primary/20 rounded-[32px] p-6 shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all cursor-pointer flex flex-col justify-between group animate-in fade-in"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 bg-muted text-foreground text-[10px] font-black uppercase tracking-widest rounded-full">
                          {room.category}
                        </span>
                        <div className="flex items-center gap-1.5 text-primary">
                          <Activity size={12} className="animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Live
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors font-serif">
                        {room.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {room.description}
                      </p>
                    </div>
                    <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare size={14} />
                        <span className="text-xs font-bold">
                          {room._count?.messages || 0} messages
                        </span>
                      </div>
                      {isJoined ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleLeaveRoom(e, room.id)}
                          className="h-8 px-4 rounded-full font-bold text-xs bg-green-500/10 text-green-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer group/btn"
                        >
                          <span className="group-hover/btn:hidden">Joined</span>
                          <span className="hidden group-hover/btn:inline">
                            Leave
                          </span>
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleJoinRoom(e, room.id)}
                          className="h-8 rounded-full font-bold text-xs bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors cursor-pointer"
                        >
                          Join Room
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {catRooms.length === 0 && (
                <div className="w-[380px] shrink-0 h-[190px] border border-dashed border-border/60 rounded-[32px] bg-secondary/15 flex flex-col justify-center items-center p-6 gap-2.5">
                  <p className="text-[11px] text-muted-foreground font-semibold text-center leading-relaxed">
                    No active rooms proposed in this category yet.
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate("/home");
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-primary h-8 hover:text-primary/80"
                  >
                    Launch First Room
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Masonry Takes Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <Flame size={20} className="text-primary" />
          <h2
            className="text-2xl font-black text-foreground"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Top Takes
          </h2>
        </div>

        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => navigate(`/room/${msg.roomId}`)}
              className="break-inside-avoid bg-card border border-border/50 rounded-[32px] p-6 hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group mb-6 animate-in fade-in"
            >
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={msg.user.avatar || undefined}
                      name={msg.user.username}
                      size="sm"
                      userId={msg.user.id}
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {msg.user.name || msg.user.username}
                      </p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        @{msg.user.username}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-lg leading-relaxed text-foreground font-serif">
                  "{msg.content}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full border border-border/50 text-xs">
                    <MessageSquare
                      size={12}
                      className="text-muted-foreground"
                    />
                    <span className="font-bold text-foreground">
                      View Thread
                    </span>
                  </div>
                  <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className="w-full text-center py-20 text-muted-foreground font-medium text-sm">
              No take logs found in active rooms.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default DiscussionsDashboard;
