import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Compass, Search, Filter, Activity } from 'lucide-react';
import { RoomCard } from '@/components/features/RoomCard';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'motion/react';
import { connectSocket, getSocket } from '@/services/socket';

export function RoomDiscovery() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialCategory = searchParams.get('category') || 'All Topics';
  const initialQuery = searchParams.get('q') || '';
  
  const [activeCategory, setActiveCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveCategory(searchParams.get('category') || 'All Topics');
    if (searchParams.get('q')) setSearchQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch('/api/rooms');
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        }
      } catch (error) {
        console.error("Failed to fetch rooms", error);
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();

    // Real-time: patch member/message/activeNow counts as socket updates arrive
    connectSocket();
    const socket = getSocket();
    const handleRoomStats = (data: { roomId: string; memberCount?: number; messageCount?: number; activeNow?: number }) => {
      setRooms(prev => prev.map(r => {
        if (r.id !== data.roomId) return r;
        const updated = { ...r, _count: { ...r._count } };
        if (data.memberCount !== undefined) updated._count.members = data.memberCount;
        if (data.messageCount !== undefined) updated._count.messages = data.messageCount;
        if (data.activeNow !== undefined) updated.activeNow = data.activeNow;
        return updated;
      }));
    };
    socket.on('room_stats_update', handleRoomStats);
    return () => {
      socket.off('room_stats_update', handleRoomStats);
    };
  }, []);

  const filteredRooms = rooms.filter((room) => {
    const matchesCategory = activeCategory === 'All Topics' || room.category === activeCategory;
    const matchesSearch = !searchQuery || 
                          room.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (room.tags && room.tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase())));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-12 pb-10 max-w-7xl mx-auto">
      <DashboardHeader 
        title="Discover"
        description="Find your place in the network. Explore communities by topic, activity, or impact."
        icon={<Compass size={24} />}
      />

      {/* Hero Search Section */}
      <div className="relative p-12 bg-foreground dark:bg-card rounded-[40px] text-background dark:text-foreground overflow-hidden border dark:border-border/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="relative z-10 space-y-8 max-w-2xl">
          <h2 
            className="text-4xl md:text-5xl tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
          >
            Find the conversations that matter to you.
          </h2>
          <div className="relative">
            <Search size={24} className="absolute left-6 top-1/2 -translate-y-1/2 text-background/30 dark:text-foreground/30" />
            <Input 
              placeholder="Search for topics, keywords, or communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-16 pl-16 pr-8 bg-background/10 border-background/10 dark:bg-white/10 dark:border-white/10 rounded-2xl text-lg text-background dark:text-foreground placeholder:text-background/20 dark:placeholder:text-foreground/30 focus-visible:ring-primary/50 focus-visible:bg-background/15 transition-all"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-background/40 dark:text-foreground/40 pt-2 pr-2">Popular:</span>
            {['Climate', 'AI', 'Humanitarian', 'EU'].map((tag) => (
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
        <div className="flex-1 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <div className="space-y-1">
               <h2 
                className="text-2xl text-foreground tracking-tight"
                style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
              >
                {activeCategory}
              </h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Showing {filteredRooms.length} relevant communities
              </p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl font-bold border-2 gap-2 h-10 px-6">
              <Filter size={16} /> Advanced Filters
            </Button>
          </div>

          {loading ? (
            <div className="py-24 text-center"><Activity className="animate-spin mx-auto text-primary" size={32} /></div>
          ) : filteredRooms.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredRooms.map((room, i) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <RoomCard
                    room={{
                      ...room,
                      memberCount: room._count?.members || 0,
                      messageCount: room._count?.messages || 0,
                      activeNow: room.activeNow ?? Math.ceil((room._count?.members || 1) * 0.4)
                    }}
                    onClick={(id) => navigate(`/room/${id}`)}
                    onJoin={(id) => navigate(`/room/${id}`)}
                    className="bg-card border-border/50 rounded-[32px] p-2 hover:shadow-2xl hover:shadow-primary/5"
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center space-y-6 bg-card rounded-[40px] border-2 border-dashed border-border">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
                <Search size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>No communities found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
                  We couldn't find any rooms matching your search. Try broadening your criteria.
                </p>
              </div>
              <Button variant="default" onClick={() => {setSearchQuery(''); setActiveCategory('All Topics');}} className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest">
                Reset All Filters
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
