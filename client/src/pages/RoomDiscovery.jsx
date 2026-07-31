import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MagnifyingGlassIcon,
  ArrowTrendingUpIcon,
  FireIcon,
  SparklesIcon,
  ArrowPathIcon,
  PlusIcon,
  LinkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { RoomCard } from "@/components/shared/RoomCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRooms } from "@/hooks/useRooms";
import { apiClient } from "@/services/apiClient";
import { toast } from "sonner";
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

function decodeHtmlEntities(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function sanitizeSearchQuery(queryStr) {
  if (!queryStr) return "";
  const decoded = decodeHtmlEntities(queryStr.trim());
  return decoded.replace(/^["']|["']$/g, "").trim();
}

export function RoomDiscovery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = searchParams.get("category") || "All Topics";
  const initialQuery = sanitizeSearchQuery(searchParams.get("q") || "");
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

  // Suggestions & Overlay State
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Create Room Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "Technology",
    tags: "",
    sourceUrl: "",
    imageUrl: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleRoomsCount(6);
  }, [activeCategory, searchQuery, sortBy]);

  const {
    useRoomsQuery,
    joinRoomMutation,
    leaveRoomMutation,
    useCategoriesQuery,
    createRoomMutation,
  } = useRooms();

  const { data: serverCategories } = useCategoriesQuery();
  const categoriesList = serverCategories ? ["All Topics", ...serverCategories] : CATEGORIES;
  const selectCategories = serverCategories || CATEGORIES.filter((c) => c !== "All Topics");

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
        top: mainContent.scrollTop + offset - 20,
        behavior: "smooth",
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
      (cat) => cat.toLowerCase().includes(trimmed) && cat !== "All Topics"
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
    const rawQ = searchParams.get("q");
    if (cat) {
      setActiveCategory(cat);
      if (!rawQ) {
        setSearchQuery("");
      }
    } else {
      setActiveCategory("All Topics");
    }
    if (rawQ) {
      const cleanQ = sanitizeSearchQuery(rawQ);
      setSearchQuery(cleanQ);
      setTimeout(scrollToResults, 100);
    } else if (cat) {
      setTimeout(scrollToResults, 100);
    }
  }, [searchParams]);

  const filteredRooms = useMemo(() => {
    const cleanSearch = searchQuery.toLowerCase().trim();
    if (!cleanSearch) return rooms;
    return rooms.filter((room) => {
      return (
        room.title.toLowerCase().includes(cleanSearch) ||
        room.description.toLowerCase().includes(cleanSearch) ||
        room.category.toLowerCase().includes(cleanSearch) ||
        (room.tags &&
          room.tags.some((t) => t.toLowerCase().includes(cleanSearch)))
      );
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

  function formatCategory(cat) {
    if (!cat) return "Technology";
    const normalized = cat.trim().toLowerCase();
    const found = selectCategories.find((c) => c.toLowerCase() === normalized);
    return found || "Technology";
  }

  // Fetch or generate room suggestions when no rooms match the query -> triggers Overlay Modal
  useEffect(() => {
    const cleanQuery = sanitizeSearchQuery(searchQuery);
    const targetUrl = searchParams.get("url") || "";

    if ((cleanQuery.length >= 2 || targetUrl) && sortedRooms.length === 0 && !isLoading) {
      let isMounted = true;
      setIsSuggesting(true);
      setShowOverlay(true);

      const fetchSuggestions = async () => {
        try {
          let extracted = null;

          // Crawl/scrape webpage if URL parameter is present
          if (targetUrl) {
            try {
              const extractRes = await apiClient.post("/extension/extract", { url: targetUrl });
              if (extractRes.data?.data) {
                extracted = extractRes.data.data;
              }
            } catch (err) {
              console.warn("Webpage extraction failed, proceeding with title search:", err);
            }
          }

          const suggestPayload = extracted
            ? {
                title: extracted.title || cleanQuery,
                description: extracted.description,
                headings: extracted.headings,
                topics: extracted.topics,
                ogImage: extracted.ogImage,
                source: extracted.source,
                url: extracted.url || targetUrl,
              }
            : {
                title: cleanQuery,
                description: `Discussion topic around "${cleanQuery}"`,
                topics: [cleanQuery],
                url: targetUrl || undefined,
              };

          const res = await apiClient.post("/extension/suggest", suggestPayload);

          if (isMounted) {
            if (res.data?.data?.suggestions?.length > 0) {
              setSuggestions(res.data.data.suggestions);
            } else {
              setSuggestions(buildFallbackSuggestions(cleanQuery || extracted?.title || "Discussion", activeCategory, targetUrl));
            }
            setShowOverlay(true);
          }
        } catch (err) {
          console.error("Error fetching room suggestions:", err);
          if (isMounted) {
            setSuggestions(buildFallbackSuggestions(cleanQuery || "Discussion", activeCategory, targetUrl));
            setShowOverlay(true);
          }
        } finally {
          if (isMounted) setIsSuggesting(false);
        }
      };

      fetchSuggestions();

      return () => {
        isMounted = false;
      };
    } else {
      setShowOverlay(false);
      setSuggestions([]);
    }
  }, [searchQuery, searchParams, sortedRooms.length, isLoading, activeCategory]);

  function buildFallbackSuggestions(query, category, sourceUrl = "") {
    const clean = sanitizeSearchQuery(query).replace(/\s*[-–—·|]\s*[^-–—·|]*$/, "").trim();
    const fallbackCategory = formatCategory(category !== "All Topics" ? category : "Technology");
    const cleanWords = clean
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["introducing", "start", "with", "the", "and", "for"].includes(w));

    const tagBase = cleanWords.slice(0, 3).map((w) => `#${w}`);
    const tags = tagBase.length > 0 ? tagBase : ["#discussion", "#topic"];

    return [
      {
        title: clean.length >= 10 ? clean : `Discussion: ${clean}`,
        description: `A discussion space dedicated to "${clean}".`,
        category: fallbackCategory,
        tags,
        sourceUrl,
        variant: "discussion",
      },
      {
        title: `What do you think about ${clean}?`,
        description: `Share your perspectives, insights, and debate on ${clean}.`,
        category: fallbackCategory,
        tags: [...tags, "#opinion"],
        sourceUrl,
        variant: "community",
      },
      {
        title: `${clean}: Deep Dive & Perspectives`,
        description: `Analyzing key insights, developments, and news around ${clean}.`,
        category: fallbackCategory,
        tags: [...tags, "#analysis"],
        sourceUrl,
        variant: "article_title",
      },
    ];
  }

  const handleOpenCreateModal = (suggestion = null) => {
    const rawTitle = suggestion?.title || (searchQuery.length >= 10 ? searchQuery : `Discussion: ${searchQuery}`);
    const rawDesc = suggestion?.description || `Discussion space for "${searchQuery || rawTitle}".`;

    const title = sanitizeSearchQuery(rawTitle).replace(/\s*[-–—·|]\s*[^-–—·|]*$/, "").trim();
    const description = decodeHtmlEntities(rawDesc).trim();
    const category = formatCategory(suggestion?.category || (activeCategory !== "All Topics" ? activeCategory : "Technology"));

    let tags = "";
    if (Array.isArray(suggestion?.tags) && suggestion.tags.length > 0) {
      tags = suggestion.tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(", ");
    } else {
      const cleanWords = (searchQuery || title)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !["introducing", "start", "with", "the", "and"].includes(w));
      tags = cleanWords.length > 0 ? cleanWords.map((w) => `#${w}`).join(", ") : "#discussion, #topic";
    }

    const sourceUrl = suggestion?.sourceUrl || searchParams.get("url") || "";

    setCreateForm({
      title: title.length >= 10 ? title : `Discussion: ${title}`,
      description,
      category,
      tags,
      sourceUrl,
      imageUrl: suggestion?.imageUrl || "",
    });
    setShowCreateModal(true);
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();

    if (!createForm.title.trim() || createForm.title.trim().length < 10) {
      toast.error("Room title must be at least 10 characters long");
      return;
    }
    if (!createForm.category) {
      toast.error("Please select a valid category");
      return;
    }

    const tagsArray = createForm.tags
      .replace(/#/g, " ")
      .split(/[\s,]+/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (tagsArray.length === 0) {
      toast.error("At least one hashtag is required");
      return;
    }

    setIsSubmitting(true);
    try {
      let normalizedSourceUrl = createForm.sourceUrl?.trim() || undefined;
      if (normalizedSourceUrl && !/^https?:\/\//i.test(normalizedSourceUrl)) {
        normalizedSourceUrl = `https://${normalizedSourceUrl}`;
      }

      const newRoom = await createRoomMutation.mutateAsync({
        title: createForm.title.trim(),
        description: createForm.description.trim() || `Discussion room for "${createForm.title.trim()}".`,
        category: createForm.category,
        tags: tagsArray,
        sourceUrl: normalizedSourceUrl,
        imageUrl: createForm.imageUrl || undefined,
      });

      toast.success("Discussion room launched successfully!");
      setShowCreateModal(false);
      setShowOverlay(false);
      navigate(`/room/${newRoom.id}`);
    } catch (err) {
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <MagnifyingGlassIcon className="w-[18px] h-[18px] absolute left-5 top-1/2 -translate-y-1/2 text-[#888880]/30 dark:text-foreground/30 pointer-events-none" />
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
            {isFocused &&
              searchQuery.trim().length > 0 &&
              (suggestedRooms.length > 0 ||
                suggestedCategories.length > 0 ||
                suggestedTags.length > 0) && (
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
                                {decodeHtmlEntities(room.title)}
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
          {/* Mobile Categories Selector (Visible only below lg breakpoint) */}
          <div className="lg:hidden w-full overflow-x-auto pb-4 flex gap-2 scroll-smooth shrink-0 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categoriesList.map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setActiveCategory(cat);
                    navigate(`/discover?category=${encodeURIComponent(cat)}`);
                  }}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-full transition-all shrink-0 cursor-pointer border",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-muted-foreground border-border hover:text-foreground hover:bg-secondary/80"
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>

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
              <ArrowPathIcon className="animate-spin mx-auto text-primary w-8 h-8" />
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
            <div className="py-20 text-center text-muted-foreground font-medium text-sm border border-border/40 rounded-3xl bg-card/40">
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
            Launch a debate room to discuss news stories, share opinions, or host discussions with citizens across the network.
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
            onClick={() => handleOpenCreateModal()}
            className="rounded-xl font-bold h-11 px-6 cursor-pointer"
          >
            + Launch Room
          </Button>
        </div>
      </div>

      {/* Full Screen Room Proposal Overlay Modal */}
      <Dialog open={showOverlay} onOpenChange={setShowOverlay}>
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden border border-border/80 shadow-2xl rounded-3xl bg-card z-[100]">
          <div className="relative p-8 bg-gradient-to-b from-primary/10 via-card to-card space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-6 pr-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider font-mono">
                  <SparklesIcon className="w-4 h-4 animate-pulse text-amber-500" />
                  <span>No Existing Room Found</span>
                </div>
                <h2
                  className="text-2xl font-black text-foreground tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Start the discussion on this topic!
                </h2>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {searchQuery
                    ? `No active room matches "${sanitizeSearchQuery(searchQuery)}". Pick a suggested title below to launch a discussion room, or create your own custom room.`
                    : "No matching room exists. Launch a new room to host discussions on this topic!"}
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowOverlay(false);
                  handleOpenCreateModal();
                }}
                className="rounded-xl font-bold h-11 px-6 shadow-lg shadow-primary/20 shrink-0 cursor-pointer flex items-center gap-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>+ Custom Room</span>
              </Button>
            </div>

            {/* Suggestions Cards Grid */}
            {isSuggesting ? (
              <div className="py-12 text-center space-y-3">
                <ArrowPathIcon className="animate-spin mx-auto text-primary w-8 h-8" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Crawling webpage and generating discussion suggestions...
                </p>
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-4">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block pl-1 font-mono">
                  Suggested Discussion Titles
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {suggestions.map((sugg, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setShowOverlay(false);
                        handleOpenCreateModal(sugg);
                      }}
                      className="group relative p-5 bg-background dark:bg-card/90 hover:bg-secondary/80 border border-border/80 hover:border-primary/50 rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-xl space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {sugg.variant === "article_title"
                              ? "Analysis"
                              : sugg.variant === "community"
                              ? "Opinion"
                              : "Discussion"}
                          </span>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {sugg.category || "Technology"}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {decodeHtmlEntities(sugg.title)}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {decodeHtmlEntities(sugg.description)}
                        </p>
                      </div>

                      <div className="pt-3 flex items-center justify-between border-t border-border/30 text-[11px] font-bold text-primary">
                        <span>Launch Room</span>
                        <span className="group-hover:translate-x-1 transition-transform">
                          →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-border/20">
              <Button
                variant="ghost"
                onClick={() => setShowOverlay(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Dismiss & Continue Browsing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Room Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-lg z-[110]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">
              Launch Discussion Room
            </DialogTitle>
            <DialogDescription>
              Create a new room to host discussions, debate perspectives, or cover news topics.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateRoomSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Room Title <span className="text-red-500">*</span>
              </label>
              <Input
                value={createForm.title}
                onChange={(e) =>
                  setCreateForm({ ...createForm, title: e.target.value })
                }
                placeholder="Title must be at least 10 characters..."
                maxLength={100}
                required
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {createForm.title.length}/100
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Description
              </label>
              <Textarea
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="What is this discussion about?"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={createForm.category}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, category: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
                  required
                >
                  {selectCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Hashtags <span className="text-red-500">*</span>
                </label>
                <Input
                  value={createForm.tags}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, tags: e.target.value })
                  }
                  placeholder="#ai, #tech, #cursor"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Source Link (Optional)</span>
              </label>
              <Input
                value={createForm.sourceUrl}
                onChange={(e) =>
                  setCreateForm({ ...createForm, sourceUrl: e.target.value })
                }
                placeholder="https://example.com/article..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Launching...
                  </span>
                ) : (
                  "Launch Room"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RoomDiscovery;
