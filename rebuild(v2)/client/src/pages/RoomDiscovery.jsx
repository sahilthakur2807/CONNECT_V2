import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Filter, Activity } from "lucide-react";
import { RoomCard } from "@/components/shared/RoomCard";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRooms } from "@/hooks/useRooms";

export function RoomDiscovery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category") || "All Topics";
  const initialQuery = searchParams.get("q") || "";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const { useRoomsQuery, joinRoomMutation, leaveRoomMutation } = useRooms();
  const { data: rooms = [], isLoading } = useRoomsQuery({
    category: activeCategory !== "All Topics" ? activeCategory : undefined,
  });

  const handleJoin = async (id) => {
    try {
      await joinRoomMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLeave = async (id) => {
    try {
      await leaveRoomMutation.mutateAsync(id);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setActiveCategory(searchParams.get("category") || "All Topics");
    if (searchParams.get("q")) setSearchQuery(searchParams.get("q") || "");
  }, [searchParams]);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      !searchQuery ||
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.tags &&
        room.tags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase()),
        ));
    return matchesSearch;
  });

  return (
    <div className="space-y-12 pb-10 w-full font-sans">
      <DashboardHeader
        title="Discover"
        description="Find your place in the network. Explore communities by topic, activity, or impact."
      />

      {/* Hero Search Section */}
      <div className="relative p-12 bg-foreground dark:bg-card rounded-[40px] text-background dark:text-foreground overflow-hidden border dark:border-border/50 animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10 space-y-8 max-w-2xl">
          <h2
            className="text-4xl md:text-5xl tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
          >
            Find the conversations that matter to you.
          </h2>
          <div className="relative">
            <Search
              size={24}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-[#888880]/30 dark:text-foreground/30 pointer-events-none"
            />
            <Input
              placeholder="Search for topics, keywords, or communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-16 pl-16 pr-8 bg-background/10 border-background/10 dark:bg-white/10 dark:border-white/10 rounded-2xl text-lg text-background dark:text-foreground placeholder:text-background/20 dark:placeholder:text-foreground/30 focus-visible:ring-primary/50 focus-visible:bg-background/15 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-background/40 dark:text-foreground/40 pt-2 pr-2">
              Popular:
            </span>
            {["Climate", "AI", "Humanitarian", "EU"].map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className="px-4 py-2 bg-background/5 dark:bg-foreground/5 hover:bg-background/10 dark:hover:bg-foreground/10 rounded-full text-xs font-bold text-background dark:text-foreground transition-colors cursor-pointer border border-background/10 dark:border-foreground/10"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Results Area */}
        <div className="flex-1 space-y-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="space-y-1">
              <h2
                className="text-2xl text-foreground tracking-tight"
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 900,
                }}
              >
                {activeCategory}
              </h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Showing {filteredRooms.length} relevant communities
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl font-bold border-2 gap-2 h-10 px-6 cursor-pointer"
            >
              <Filter size={16} /> Advanced Filters
            </Button>
          </div>

          {isLoading ? (
            <div className="py-24 text-center">
              <Activity
                className="animate-spin mx-auto text-primary"
                size={32}
              />
              <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Searching...
              </p>
            </div>
          ) : filteredRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredRooms.map((room) => (
                <div key={room.id} className="animate-in fade-in duration-200">
                  <RoomCard
                    room={room}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onClick={(id) => navigate(`/room/${id}`)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center text-muted-foreground font-medium text-sm">
              No matching discussion rooms found under this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
export default RoomDiscovery;
