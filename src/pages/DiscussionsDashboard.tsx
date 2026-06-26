import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { MessageSquare, Flame, Sparkles, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { Avatar } from '@/components/features/Avatar';
import { cn } from '@/utils/cn';

export function DiscussionsDashboard() {
  const navigate = useNavigate();
  const trendingRoomsRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'hot' | 'new'>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const [messagesRes, roomsRes] = await Promise.all([
          fetch('/api/messages/trending'),
          fetch('/api/rooms/trending')
        ]);
        if (messagesRes.ok) setMessages(await messagesRes.json());
        if (roomsRes.ok) setRooms(await roomsRes.json());
      } catch (error) {
        console.error('Failed to fetch discussions data', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div className="py-24 text-center"><Activity className="animate-spin mx-auto text-primary" size={32} /></div>;
  }

  return (
    <div className="space-y-12 pb-10 max-w-7xl mx-auto">
      <DashboardHeader 
        title="Live Discussions"
        description="Jump into the most active and provocative conversations happening across the network right now."
        icon={<MessageSquare size={24} />}
        actions={
          <div className="flex gap-2 p-1 bg-card border border-border/50 rounded-2xl shadow-sm">
            {(['all', 'hot', 'new'] as const).map(f => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-xl px-6 h-9 font-black uppercase text-[10px] tracking-widest transition-all",
                  filter === f ? "bg-foreground text-background shadow-md hover:bg-foreground hover:text-background" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                {f}
              </Button>
            ))}
          </div>
        }
      />

      {/* Hero Thread Section - Horizontal Scroll */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Trending Rooms
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => trendingRoomsRef.current?.scrollBy({ left: -400, behavior: 'smooth' })}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Scroll Left"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => trendingRoomsRef.current?.scrollBy({ left: 400, behavior: 'smooth' })}
              className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Scroll Right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        
        <div ref={trendingRoomsRef} className="flex gap-6 overflow-x-auto pb-8 pt-2 px-2 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none' }}>
          {rooms.slice(0, 5).map((room, i) => (
            <motion.div
              key={room.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => navigate(`/room/${room.id}`)}
              className="shrink-0 w-[400px] snap-center bg-card border-2 border-transparent hover:border-primary/20 rounded-[32px] p-6 shadow-sm hover:shadow-2xl hover:shadow-primary/10 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 bg-muted text-foreground text-[10px] font-black uppercase tracking-widest rounded-full">
                    {room.category}
                  </span>
                  <div className="flex items-center gap-1.5 text-primary">
                    <Activity size={12} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Live</span>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors" style={{ fontFamily: "'Georgia', serif" }}>
                  {room.title}
                </h3>
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageSquare size={14} />
                  <span className="text-xs font-bold">{room._count?.messages || 0} messages</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 rounded-full font-bold text-xs bg-primary/5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  Join Room
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Masonry Takes Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <Flame size={20} className="text-primary" />
          <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Top Takes
          </h2>
        </div>

        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/room/${msg.roomId}`)}
              className="break-inside-avoid bg-card border border-border/50 rounded-[32px] p-6 hover:border-primary/30 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group"
            >
              {msg.reactions && msg.reactions.length > 2 && (
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              )}
              <div className="relative z-10 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar src={msg.user.avatar} name={msg.user.name || msg.user.username} size="sm" />
                    <div>
                      <p className="text-xs font-bold text-foreground">{msg.user.name || msg.user.username}</p>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        in {msg.room?.category || 'Discussion'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <p className="text-lg leading-relaxed text-foreground" style={{ fontFamily: "'Georgia', serif" }}>
                  "{msg.content}"
                </p>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full border border-border/50">
                      <Flame size={12} className="text-primary" />
                      <span className="text-[10px] font-black text-foreground">{msg.reactions?.length || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full border border-border/50">
                      <MessageSquare size={12} className="text-muted-foreground" />
                      <span className="text-[10px] font-black text-foreground">{msg.replies?.length || 0}</span>
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

