import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Filter, Activity, Hash } from "lucide-react";
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

  // Auto-scroll ref
  const resultsRef = useRef(null);

  // Autocomplete suggestions state
  const [isFocused, setIsFocused] = useState(false);

  // Advanced Filters State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [minMembers, setMinMembers] = useState("");
  const [minActive, setMinActive] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("Any");
  const [selectedImpact, setSelectedImpact] = useState("Any");
  const [selectedDateRange, setSelectedDateRange] = useState("Any Time");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

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

  const filteredRooms = rooms.filter((room) => {
    // 1. Search Query Check
    const matchesSearch =
      !searchQuery ||
      room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (room.tags &&
        room.tags.some((t) =>
          t.toLowerCase().includes(searchQuery.toLowerCase()),
        ));

    if (!matchesSearch) return false;

    // 2. Member Count Check
    const memberCount = room.memberCount ?? room._count?.members ?? 0;
    if (minMembers && memberCount < parseInt(minMembers)) return false;

    // 3. Active Members Check
    const activeCount = room.activeNow ?? 0;
    if (minActive && activeCount < parseInt(minActive)) return false;

    // 4. Region Check
    if (selectedRegion && selectedRegion !== "Any") {
      const regionLower = selectedRegion.toLowerCase();
      const hasRegion =
        room.title.toLowerCase().includes(regionLower) ||
        room.description.toLowerCase().includes(regionLower) ||
        (room.tags && room.tags.some((t) => t.toLowerCase().includes(regionLower)));
      if (!hasRegion) return false;
    }

    // 5. Impact Check
    if (selectedImpact && selectedImpact !== "Any") {
      const impactLower = selectedImpact.toLowerCase();
      const hasImpact =
        room.title.toLowerCase().includes(impactLower) ||
        room.description.toLowerCase().includes(impactLower) ||
        (room.tags && room.tags.some((t) => t.toLowerCase().includes(impactLower)));
      if (!hasImpact) return false;
    }

    // 6. Date Range Check
    if (selectedDateRange && selectedDateRange !== "Any Time") {
      const createdTime = new Date(room.createdAt).getTime();
      const now = Date.now();
      if (selectedDateRange === "24h") {
        if (now - createdTime > 24 * 60 * 60 * 1000) return false;
      } else if (selectedDateRange === "7d") {
        if (now - createdTime > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (selectedDateRange === "30d") {
        if (now - createdTime > 30 * 24 * 60 * 60 * 1000) return false;
      } else if (selectedDateRange === "custom") {
        if (customStartDate && createdTime < new Date(customStartDate).getTime()) return false;
        if (customEndDate && createdTime > new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000) return false;
      }
    }

    return true;
  });

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
            <Search
              size={18}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-[#888880]/30 dark:text-foreground/30 pointer-events-none"
            />
            <Input 
              placeholder="Search for topics, keywords, or communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            </div>            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(
                  "rounded-xl font-bold border-2 gap-2 h-10 px-6 cursor-pointer transition-all",
                  showAdvancedFilters && "bg-primary/10 border-primary text-primary hover:bg-primary/15"
                )}
              >
                <Filter size={16} /> Advanced Filters
              </Button>

              {/* Advanced Filters Dropdown Popover */}
              {showAdvancedFilters && (
                <div className="absolute right-0 top-full z-30 mt-2 w-[320px] sm:w-[480px] p-5 bg-card/95 backdrop-blur-md border border-border shadow-2xl rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Min Members */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                        Min Members
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 5"
                        value={minMembers}
                        onChange={(e) => setMinMembers(e.target.value)}
                        className="h-9 rounded-lg bg-secondary/30 border-border/50 text-xs font-semibold"
                      />
                    </div>

                    {/* Min Active Members */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                        Min Active Citizens
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 2"
                        value={minActive}
                        onChange={(e) => setMinActive(e.target.value)}
                        className="h-9 rounded-lg bg-secondary/30 border-border/50 text-xs font-semibold"
                      />
                    </div>

                    {/* Region */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                        Region
                      </label>
                      <select
                        value={selectedRegion}
                        onChange={(e) => setSelectedRegion(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="Any">Any Region</option>
                        <option value="Global">Global</option>
                        <option value="Europe">Europe</option>
                        <option value="North America">North America</option>
                        <option value="Asia">Asia</option>
                        <option value="Africa">Africa</option>
                        <option value="South America">South America</option>
                        <option value="Oceania">Oceania</option>
                      </select>
                    </div>

                    {/* Impact */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                        Impact Focus
                      </label>
                      <select
                        value={selectedImpact}
                        onChange={(e) => setSelectedImpact(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="Any">Any Impact</option>
                        <option value="Advocacy">Advocacy / Policy</option>
                        <option value="Climate">Climate Action</option>
                        <option value="Humanitarian">Humanitarian Support</option>
                        <option value="Community">Community Building</option>
                      </select>
                    </div>

                    {/* Date Created */}
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground font-mono">
                        Date Created
                      </label>
                      <select
                        value={selectedDateRange}
                        onChange={(e) => setSelectedDateRange(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg bg-secondary/30 border border-border/50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="Any Time">Any Time</option>
                        <option value="24h">Last 24 Hours</option>
                        <option value="7d">Last 7 Days</option>
                        <option value="30d">Last 30 Days</option>
                        <option value="custom">Custom Range</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom Date Range Selectors */}
                  {selectedDateRange === "custom" && (
                    <div className="flex flex-col sm:flex-row gap-2.5 p-3.5 bg-secondary/20 border border-border/30 rounded-xl animate-in fade-in duration-200">
                      <div className="flex-grow space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                          Start Date
                        </label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="h-8.5 rounded-lg bg-secondary/30 border-border/50 text-xs font-semibold"
                        />
                      </div>
                      <div className="flex-grow space-y-1">
                        <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                          End Date
                        </label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="h-8.5 rounded-lg bg-secondary/30 border-border/50 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reset button */}
                  <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMinMembers("");
                        setMinActive("");
                        setSelectedRegion("Any");
                        setSelectedImpact("Any");
                        setSelectedDateRange("Any Time");
                        setCustomStartDate("");
                        setCustomEndDate("");
                      }}
                      className="rounded-lg font-bold text-xs h-8 px-3.5 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      Reset Filters
                    </Button>
                  </div>
                </div>
              )}
            </div>
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
