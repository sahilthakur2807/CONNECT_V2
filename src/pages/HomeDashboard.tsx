import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Home, TrendingUp, Sparkles, Flame, Activity, X } from 'lucide-react';
import { RoomCard } from '@/components/features/RoomCard';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';

export function HomeDashboard() {
  const navigate = useNavigate();
  
  const [trendingRooms, setTrendingRooms] = useState<any[]>([]);
  const [newRooms, setNewRooms] = useState<any[]>([]);
  const [hotRooms, setHotRooms] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'hot' | 'new'>('trending');

  // Dialog states
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [roomForm, setRoomForm] = useState({ title: '', description: '', category: 'General', tags: '', sourceUrl: '' });
  const [communityForm, setCommunityForm] = useState({ name: '', description: '', category: 'General' });

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('newsconnect_token');
      const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [roomsRes, newRoomsRes, hotRes, usersRes] = await Promise.all([
        fetch('/api/rooms/trending', { headers }),
        fetch('/api/rooms/new', { headers }),
        fetch('/api/rooms/hot', { headers }),
        fetch('/api/users/active', { headers })
      ]);
      
      const rooms = await roomsRes.json();
      const newR = await newRoomsRes.json();
      const hot = await hotRes.json();
      const users = await usersRes.json();

      setTrendingRooms(rooms);
      setNewRooms(newR); 
      setHotRooms(hot);
      setActiveUsers(users);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.title || !roomForm.description || !roomForm.category) return;
    try {
      const token = localStorage.getItem('newsconnect_token');
      const tagsArray = roomForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: roomForm.title,
          description: roomForm.description,
          category: roomForm.category,
          tags: tagsArray,
          sourceUrl: roomForm.sourceUrl || undefined
        })
      });
      if (res.ok) {
        const newRoom = await res.json();
        setShowCreateRoom(false);
        setRoomForm({ title: '', description: '', category: 'General', tags: '', sourceUrl: '' });
        fetchData();
        navigate(`/room/${newRoom.id}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleCreateCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!communityForm.name || !communityForm.description) return;
    try {
      const token = localStorage.getItem('newsconnect_token');
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(communityForm)
      });
      if (res.ok) {
        setShowCreateCommunity(false);
        setCommunityForm({ name: '', description: '', category: 'General' });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create community:', err);
    }
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Activity className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="pb-10 max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <DashboardHeader 
        title="Home"
        description="Your personalized living network of conversations and communities."
        icon={<Home size={24} />}
        actions={
          <div className="flex gap-2.5">
            <Button onClick={() => setShowCreateCommunity(true)} variant="outline" className="rounded-xl font-bold border-2 h-10 px-4 cursor-pointer">
              + Sphere
            </Button>
            <Button onClick={() => setShowCreateRoom(true)} className="rounded-xl font-bold h-10 px-4 cursor-pointer">
              + Room
            </Button>
          </div>
        }
      />

      {/* Active Citizens (Horizontal list) */}
      {activeUsers.length > 0 && (
        <div className="space-y-4 bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center justify-between">
            <h3 
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Active Citizens
            </h3>
            <span 
              className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-[0.1em]" 
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {activeUsers.length} Online
            </span>
          </div>
          <div className="flex gap-5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
            {activeUsers.map((u) => (
              <div 
                key={u.id} 
                className="flex flex-col items-center gap-2 min-w-[76px] group cursor-pointer text-center"
                onClick={() => navigate(`/profile/${u.id}`)}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-card shadow-sm ring-2 ring-border group-hover:ring-primary/40 transition-all duration-300 group-hover:scale-105">
                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  {u.status === 'online' && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <p className="text-[10px] font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {u.name || u.username}
                  </p>
                  <p className="text-[8px] font-black text-primary uppercase tracking-widest truncate">
                    {u.badges?.[0] || 'Member'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Debate of the Day Hero Banner */}
      {trendingRooms.length > 0 && (
        <div className="relative bg-foreground rounded-3xl text-background p-8 sm:p-10 overflow-hidden group shadow-xl dark:bg-[#1a1a1a] dark:text-foreground">
          {/* Background decorative glow */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[120px] -mr-32 -mt-32 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col justify-between h-full space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.15em", fontWeight: 900 }}>
                <Flame size={14} className="animate-pulse text-primary" />
                DEBATE OF THE DAY
              </div>
              
              <h2 
                className="text-2xl sm:text-3xl lg:text-4xl leading-tight max-w-3xl font-black text-card-foreground dark:text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                "{trendingRooms[0].title}"
              </h2>
              
              <p className="text-muted-foreground text-sm max-w-xl line-clamp-2" style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                {trendingRooms[0].description}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-border/20">
              <div className="flex items-center gap-8">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Voices</span>
                  <span className="text-base font-bold text-card-foreground dark:text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{trendingRooms[0]._count?.members || 0} Citizens</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Activity</span>
                  <span className="text-base font-bold text-card-foreground dark:text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{trendingRooms[0]._count?.messages || 0} Replies</span>
                </div>
              </div>
              
              <Button 
                onClick={() => navigate(`/room/${trendingRooms[0].id}`)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11 px-6 font-black uppercase text-[10px] tracking-widest cursor-pointer transition-all"
              >
                Branch in →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Feed Tabs Selector & Feed List */}
      <div className="space-y-8">
        <div className="border-b border-border pb-1 flex items-center justify-between">
          <div className="flex gap-8">
            {[
              { id: 'trending', label: 'Trending Feed', icon: <TrendingUp size={16} /> },
              { id: 'hot', label: 'Hot Debates', icon: <Flame size={16} /> },
              { id: 'new', label: 'Newly Created', icon: <Sparkles size={16} /> }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "pb-4 flex items-center gap-2.5 text-sm font-bold border-b-2 px-1 transition-all relative cursor-pointer",
                  activeTab === tab.id 
                    ? "border-primary text-primary font-black" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Spacious Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeTab === 'trending' && trendingRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={{
                ...room,
                memberCount: room._count?.members || 0,
                messageCount: room._count?.messages || 0,
                activeNow: Math.ceil((room._count?.members || 1) * 0.4)
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={(id) => navigate(`/room/${id}`)}
              className="bg-card border border-border/50 rounded-3xl p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
            />
          ))}
          {activeTab === 'hot' && hotRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={{
                ...room,
                memberCount: room._count?.members || 0,
                messageCount: room._count?.messages || 0,
                activeNow: Math.ceil((room._count?.members || 1) * 0.4)
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={(id) => navigate(`/room/${id}`)}
              className="bg-card border border-border/50 rounded-3xl p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
            />
          ))}
          {activeTab === 'new' && newRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={{
                ...room,
                memberCount: room._count?.members || 0,
                messageCount: room._count?.messages || 0,
                activeNow: Math.ceil((room._count?.members || 1) * 0.3)
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={(id) => navigate(`/room/${id}`)}
              className="bg-card border border-border/50 rounded-3xl p-6 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-300"
            />
          ))}
        </div>
      </div>

      {/* Propose a Topic Clean Callout Banner */}
      <div className="bg-muted border border-border/50 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Have a perspective to share?
          </h3>
          <p className="text-xs text-muted-foreground font-medium max-w-md">
            Launch a debate room to discuss news stories, share opinions, or host discussions with citizens across the network.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowCreateCommunity(true)} variant="outline" className="rounded-xl font-bold border-2 h-11 px-6 cursor-pointer">
            + Sphere
          </Button>
          <Button onClick={() => setShowCreateRoom(true)} className="rounded-xl font-bold h-11 px-6 cursor-pointer">
            + Launch Room
          </Button>
        </div>
      </div>

      {/* ── CREATE ROOM MODAL ── */}
      {showCreateRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-lg w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button onClick={() => setShowCreateRoom(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={20} />
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Propose a Discussion</h2>
              <p className="text-sm text-muted-foreground">Create a room to discuss news stories, debates, or ideas.</p>
            </div>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Room Title</label>
                <Input 
                  value={roomForm.title} 
                  onChange={e => setRoomForm({...roomForm, title: e.target.value})} 
                  placeholder="e.g. EU AI Act Compliance Models" 
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                <Textarea 
                  value={roomForm.description} 
                  onChange={e => setRoomForm({...roomForm, description: e.target.value})} 
                  placeholder="What is this discussion about?" 
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Category</label>
                  <Input 
                    value={roomForm.category} 
                    onChange={e => setRoomForm({...roomForm, category: e.target.value})} 
                    placeholder="e.g. Tech, Politics, Climate" 
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Tags (Comma separated)</label>
                  <Input 
                    value={roomForm.tags} 
                    onChange={e => setRoomForm({...roomForm, tags: e.target.value})} 
                    placeholder="e.g. AI, ethics, policy" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Article URL (Optional)</label>
                <Input 
                  value={roomForm.sourceUrl} 
                  onChange={e => setRoomForm({...roomForm, sourceUrl: e.target.value})} 
                  placeholder="https://example.com/article" 
                  type="url"
                />
              </div>
              <Button type="submit" className="w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest mt-2 cursor-pointer">
                Launch Room
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* ── CREATE COMMUNITY MODAL ── */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-lg w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button onClick={() => setShowCreateCommunity(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={20} />
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Form a Sphere</h2>
              <p className="text-sm text-muted-foreground">Establish a brand new community cluster for ideas and articles.</p>
            </div>
            <form onSubmit={handleCreateCommunity} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Community Name</label>
                <Input 
                  value={communityForm.name} 
                  onChange={e => setCommunityForm({...communityForm, name: e.target.value})} 
                  placeholder="e.g. Technology & Society" 
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Description</label>
                <Textarea 
                  value={communityForm.description} 
                  onChange={e => setCommunityForm({...communityForm, description: e.target.value})} 
                  placeholder="Describe the topics and rules of this sphere..." 
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Category</label>
                <Input 
                  value={communityForm.category} 
                  onChange={e => setCommunityForm({...communityForm, category: e.target.value})} 
                  placeholder="e.g. Science, Ethics, Economics" 
                  required
                />
              </div>
              <Button type="submit" className="w-full rounded-2xl h-12 font-black uppercase text-xs tracking-widest mt-2 cursor-pointer">
                Establish Sphere
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
