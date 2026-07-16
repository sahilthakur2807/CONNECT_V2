import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MagnifyingGlassIcon, ArrowTrendingUpIcon, FireIcon, SparklesIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { RoomCard } from "@/components/shared/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRooms } from "@/hooks/useRooms";
import { cn } from "@/utils/cn";

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

export function RoomDiscovery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category") || "All Topics";
  const initialQuery = searchParams.get("q") || "";
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [inputText, setInputText] = useState(initialQuery);

  // Debounce search input to filter query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(inputText);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputText]);

  // Sync input text when search query is changed externally
  useEffect(() => {
    setInputText(searchQuery);
  }, [searchQuery]);

  // Auto-scroll ref
  const resultsRef = useRef(null);

  // Autocomplete suggestions state
  const [isFocused, setIsFocused] = useState(false);

  // Sorting and Pagination State
  const [sortBy, setSortBy] = useState("trending"); // "trending", "hot", "newest"
  const [visibleRoomsCount, setVisibleRoomsCount] = useState(6);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleRoomsCount(6);
  }, [activeCategory, searchQuery, sortBy]);

  const { useRoomsQuery, joinRoomMutation, leaveRoomMutation } = useRooms();
  const { data: rooms = [], isLoading } = useRoomsQuery({
    category: activeCategory !== "All Topics" ? activeCategory : undefined,
  });

  const scrollToResults = () => {
    const mainContent = document.getElementById("main-content");
    if (mainContent && resultsRef.current) {
      const parentRect = mainContent.getBoundingClientRect();
      const elementRect = resultsRef.current.getBoundingClientRect();
      const offset = elementRect.top - parentRect.top;
      mainContent.scrollTo({
        top: mainContent.scrollTop + offset - 20, // 20px padding adjustment
        behavior: "smooth"
      });
    }
  };

  // Extract all unique tags from active category rooms for autocomplete
  const allTags = useMemo(() => {
    const tagsSet = new Set();
    rooms.forEach((r) => {
      if (r.tags) {
        r.tags.forEach((t) => tagsSet.add(t));
      }
    });
    return Array.from(tagsSet);
  }, [rooms]);

  // Autocomplete matching suggestions
  const suggestedRooms = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return rooms
      .filter((r) => r.title.toLowerCase().includes(trimmed))
      .slice(0, 3);
  }, [rooms, searchQuery]);

  const suggestedCategories = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return CATEGORIES.filter(
      (cat) =>
        cat.toLowerCase().includes(trimmed) &&
        cat !== "All Topics"
    ).slice(0, 3);
  }, [searchQuery]);

  const suggestedTags = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return [];
    return allTags
      .filter((tag) => tag.toLowerCase().includes(trimmed))
      .slice(0, 4);
  }, [allTags, searchQuery]);

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
    const cat = searchParams.get("category");
    const q = searchParams.get("q");
    if (cat) {
      setActiveCategory(cat);
      if (!q) {
        setSearchQuery("");
      }
    } else {
      setActiveCategory("All Topics");
    }
    if (q) {
      setSearchQuery(q);
      setTimeout(scrollToResults, 100);
    } else if (cat) {
      setTimeout(scrollToResults, 100);
    }
  }, [searchParams]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch =
        !searchQuery ||
        room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.tags &&
          room.tags.some((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase()),
          ));
      return matchesSearch;
    });
  }, [rooms, searchQuery]);

  const sortedRooms = useMemo(() => {
    const list = [...filteredRooms];
    if (sortBy === "trending") {
      return list.sort((a, b) => {
        const aCount = a.memberCount ?? a._count?.members ?? 0;
        const bCount = b.memberCount ?? b._count?.members ?? 0;
        return bCount - aCount;
      });
    } else if (sortBy === "hot") {
      return list.sort((a, b) => {
        const aMsg = a._count?.messages ?? 0;
        const bMsg = b._count?.messages ?? 0;
        return bMsg - aMsg;
      });
    } else if (sortBy === "newest") {
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return list;
  }, [filteredRooms, sortBy]);

  return (
    <div className="space-y-12 pb-10 w-full font-sans">
      {/* Hero Search Section */}
      <div className="relative p-12 bg-foreground dark:bg-card rounded-[40px] text-background dark:text-foreground overflow-hidden border dark:border-border/50 animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
        <div className="relative z-10 space-y-8 max-w-1xl">
          <h2
            className="text-4xl md:text-5xl tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
          >
            Find the conversations that matter to you.
          </h2>
          <div className="relative ">
            <MagnifyingGlassIcon
              className="w-[18px] h-[18px] absolute left-5 top-1/2 -translate-y-1/2 text-[#888880]/30 dark:text-foreground/30 pointer-events-none"
            />
            <Input 
              placeholder="Search for topics, keywords, or communities..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  scrollToResults();
                }
              }}
              className="h-12 pl-12 pr-6 bg-background/10 border-background/10 dark:bg-white/10 dark:border-white/10 rounded-xl text-sm text-background dark:text-foreground placeholder:text-background/20 dark:placeholder:text-foreground/30 focus-visible:ring-primary/50 focus-visible:bg-background/15 transition-all"
            />

            {/* Autocomplete Suggestions Popover */}
            {isFocused && searchQuery.trim().length > 0 && (suggestedRooms.length > 0 || suggestedCategories.length > 0 || suggestedTags.length > 0) && (
              <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-card text-card-foreground border border-border/80 shadow-2xl rounded-2xl overflow-hidden p-3 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                {suggestedRooms.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest font-mono pl-2 block">
                      Matching Rooms
                    </span>
                    <div className="space-y-0.5">
                      {suggestedRooms.map((room) => (
                        <div
                          key={room.id}
                          onMouseDown={() => {
                            navigate(`/room/${room.id}`);
                          }}
                          className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary cursor-pointer transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">
                              {room.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {room.category} • {room._count?.members || 0} members
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedCategories.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest font-mono pl-2 block">
                      Categories
                    </span>
                    <div className="flex flex-wrap gap-1.5 pl-2">
                      {suggestedCategories.map((cat) => (
                        <button
                          key={cat}
                          onMouseDown={() => {
                            setActiveCategory(cat);
                            setSearchQuery("");
                            setTimeout(scrollToResults, 100);
                          }}
                          className="px-3 py-1.5 bg-secondary/80 hover:bg-secondary rounded-lg text-xs font-bold text-foreground transition-colors cursor-pointer border border-border/30"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedTags.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest font-mono pl-2 block">
                      Related Tags
                    </span>
                    <div className="flex flex-wrap gap-1.5 pl-2">
                      {suggestedTags.map((tag) => (
                        <button
                          key={tag}
                          onMouseDown={() => {
                            setSearchQuery(tag);
                            setTimeout(scrollToResults, 100);
                          }}
                          className="px-3 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-lg text-xs font-bold transition-colors cursor-pointer border border-primary/10"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-background/40 dark:text-foreground/40 pt-2 pr-2">
              Popular:
            </span>
            {["Climate", "AI", "Humanitarian", "EU"].map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setSearchQuery(tag);
                  setTimeout(scrollToResults, 100);
                }}
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
        <div ref={resultsRef} className="flex-1 min-h-[85vh] space-y-8 animate-in fade-in duration-300">
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
            <div className="flex items-center gap-6 self-end -mb-6">
              <button
                onClick={() => setSortBy("trending")}
                className={cn(
                  "flex items-center gap-2 pb-6 text-sm font-bold transition-all relative cursor-pointer border-b-2",
                  sortBy === "trending"
                    ? "text-[#e11d48] border-[#e11d48] font-black"
                    : "text-muted-foreground hover:text-foreground font-semibold border-transparent"
                )}
              >
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span>Trending Feed</span>
              </button>

              <button
                onClick={() => setSortBy("hot")}
                className={cn(
                  "flex items-center gap-2 pb-6 text-sm font-bold transition-all relative cursor-pointer border-b-2",
                  sortBy === "hot"
                    ? "text-[#e11d48] border-[#e11d48] font-black"
                    : "text-muted-foreground hover:text-foreground font-semibold border-transparent"
                )}
              >
                <FireIcon className="w-4 h-4" />
                <span>Hot Debates</span>
              </button>

              <button
                onClick={() => setSortBy("newest")}
                className={cn(
                  "flex items-center gap-2 pb-6 text-sm font-bold transition-all relative cursor-pointer border-b-2",
                  sortBy === "newest"
                    ? "text-[#e11d48] border-[#e11d48] font-black"
                    : "text-muted-foreground hover:text-foreground font-semibold border-transparent"
                )}
              >
                <SparklesIcon className="w-4 h-4" />
                <span>Newly Created</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-24 text-center">
              <ArrowPathIcon
                className="animate-spin mx-auto text-primary w-8 h-8"
              />
              <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Searching...
              </p>
            </div>
          ) : sortedRooms.length > 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {sortedRooms.slice(0, visibleRoomsCount).map((room, idx) => (
                  <div key={room.id} className="animate-in fade-in duration-200">
                    <RoomCard
                      room={room}
                      index={idx}
                      activeTab={sortBy}
                      onJoin={handleJoin}
                      onLeave={handleLeave}
                      onClick={(id) => navigate(`/room/${id}`)}
                    />
                  </div>
                ))}
              </div>
              {sortedRooms.length > visibleRoomsCount && (
                <div className="flex justify-center pt-4">
                  <Button
                    onClick={() => setVisibleRoomsCount((prev) => prev + 6)}
                    className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10 cursor-pointer"
                  >
                    Load More Rooms
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="py-20 text-center text-muted-foreground font-medium text-sm">
              No matching discussion rooms found under this filter.
            </div>
          )}
        </div>
      </div>

      {/* Have a perspective to share? CTA */}
      <div className="bg-muted border border-border/50 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 mt-8">
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
            onClick={() => navigate("/home?createCommunity=true")}
            variant="outline"
            className="rounded-xl font-bold border-2 h-11 px-6 cursor-pointer"
          >
            + Sphere
          </Button>
          <Button
            onClick={() => navigate("/home?createRoom=true")}
            className="rounded-xl font-bold h-11 px-6 cursor-pointer"
          >
            + Launch Room
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RoomDiscovery;
