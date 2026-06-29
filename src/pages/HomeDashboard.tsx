import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Home, TrendingUp, Sparkles, Flame, Activity, X, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { RoomCard } from '@/components/features/RoomCard';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { connectSocket, getSocket } from '@/services/socket';
import { apiClient } from '@/services/api';

export function HomeDashboard() {
  const navigate = useNavigate();
  const activeFriendsRef = useRef<HTMLDivElement>(null);
  
  const [trendingRooms, setTrendingRooms] = useState<any[]>([]);
  const [newRooms, setNewRooms] = useState<any[]>([]);
  const [hotRooms, setHotRooms] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'trending' | 'hot' | 'new'>('trending');

  // Friend search states
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState('');

  // Dialog states
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [roomForm, setRoomForm] = useState({ title: '', description: '', category: 'General', tags: '', sourceUrl: '' });
  const [communityForm, setCommunityForm] = useState({ name: '', description: '', category: 'General' });

  const fetchData = async () => {
    try {
      const [roomsRes, newRoomsRes, hotRes, usersRes] = await Promise.all([
        apiClient.get('/rooms/trending'),
        apiClient.get('/rooms/new'),
        apiClient.get('/rooms/hot'),
        apiClient.get('/users/active-friends')
      ]);

      setTrendingRooms(roomsRes.data);
      setNewRooms(newRoomsRes.data); 
      setHotRooms(hotRes.data);
      setActiveUsers(usersRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    connectSocket();

    const socket = getSocket();
    const handleFriendOnline = (friend: any) => {
      setActiveUsers((prev) => {
        const friendWithOnline = { ...friend, status: 'online' };
        let updated;
        if (prev.some((u) => u.id === friend.id)) {
          updated = prev.map((u) => u.id === friend.id ? { ...u, ...friendWithOnline } : u);
        } else {
          updated = [...prev, friendWithOnline];
        }
        return [...updated].sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
          return (a.name || a.username).localeCompare(b.name || b.username);
        });
      });
    };

    const handleFriendOffline = ({ userId }: { userId: string }) => {
      setActiveUsers((prev) => {
        const updated = prev.map((u) => u.id === userId ? { ...u, status: 'offline' } : u);
        return [...updated].sort((a, b) => {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
          return (a.name || a.username).localeCompare(b.name || b.username);
        });
      });
    };

    const handleRoomStatsUpdate = ({ roomId, messageCount, memberCount, activeNow }: { roomId: string; messageCount?: number; memberCount?: number; activeNow?: number }) => {
      const updateFn = (prev: any[]) => prev.map(room => {
        if (room.id !== roomId) return room;
        const updated = { ...room };
        if (messageCount !== undefined) {
          if (!updated._count) updated._count = {};
          updated._count.messages = messageCount;
        }
        if (memberCount !== undefined) {
          if (!updated._count) updated._count = {};
          updated._count.members = memberCount;
        }
        if (activeNow !== undefined) {
          updated.activeNow = activeNow;
        }
        return updated;
      });

      setTrendingRooms(updateFn);
      setNewRooms(updateFn);
      setHotRooms(updateFn);
    };

    socket.on('friend_online', handleFriendOnline);
    socket.on('friend_offline', handleFriendOffline);
    socket.on('room_stats_update', handleRoomStatsUpdate);

    return () => {
      socket.off('friend_online', handleFriendOnline);
      socket.off('friend_offline', handleFriendOffline);
      socket.off('room_stats_update', handleRoomStatsUpdate);
    };
  }, []);

  const handleJoinRoom = async (roomId: string) => {
    try {
      const res = await apiClient.post(`/rooms/${roomId}/join`);
      if (res.status === 200 || res.status === 201) {
        const updateFn = (prev: any[]) => prev.map(r => {
          if (r.id !== roomId) return r;
          return {
            ...r,
            isJoined: true,
            _count: {
              ...r._count,
              members: (r._count?.members || 0) + 1
            }
          };
        });
        setTrendingRooms(updateFn);
        setNewRooms(updateFn);
        setHotRooms(updateFn);
      }
    } catch (err) {
      console.error('Failed to join room:', err);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      const res = await apiClient.post(`/rooms/${roomId}/leave`);
      if (res.status === 200 || res.status === 201) {
        const updateFn = (prev: any[]) => prev.map(r => {
          if (r.id !== roomId) return r;
          return {
            ...r,
            isJoined: false,
            _count: {
              ...r._count,
              members: Math.max(0, (r._count?.members || 0) - 1)
            }
          };
        });
        setTrendingRooms(updateFn);
        setNewRooms(updateFn);
        setHotRooms(updateFn);
      }
    } catch (err) {
      console.error('Failed to leave room:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomForm.title || !roomForm.description || !roomForm.category) return;
    try {
      const tagsArray = roomForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await apiClient.post('/rooms', {
        title: roomForm.title,
        description: roomForm.description,
        category: roomForm.category,
        tags: tagsArray,
        sourceUrl: roomForm.sourceUrl || undefined
      });
      if (res.status === 200 || res.status === 201) {
        const newRoom = res.data;
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
      const res = await apiClient.post('/communities', communityForm);
      if (res.status === 200 || res.status === 201) {
        setShowCreateCommunity(false);
        setCommunityForm({ name: '', description: '', category: 'General' });
        fetchData();
      }
    } catch (err) {
      console.error('Failed to create community:', err);
    }
  };

  const handleFriendSearch = async (query: string) => {
    setFriendSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearch(false);
      return;
    }

    try {
      const res = await apiClient.get(`/users/search-by-username?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
      setShowSearch(true);
    } catch (err) {
      console.error('Failed to search friends:', err);
    }
  };

  const handleAddFriend = async (friendId: string) => {
    setAddingFriendId(friendId);
    try {
      const res = await apiClient.post('/users/add-friend', { friendId });
      if (res.status === 200 || res.status === 201) {
        setSearchResults(prev => prev.map(u => u.id === friendId ? { ...u, isFriend: true } : u));
        // Refresh active friends list
        const friendsRes = await apiClient.get('/users/active-friends');
        setActiveUsers(friendsRes.data);
      }
    } catch (err) {
      console.error('Failed to add friend:', err);
    } finally {
      setAddingFriendId('');
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

      {/* Active Friends (Horizontal list) */}
      <div className="space-y-4 bg-card border border-border/50 p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Friends
            </h3>
            <span 
              className="flex items-center gap-1.5 text-green-500 text-[10px] font-black uppercase tracking-[0.1em]" 
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              {activeUsers.filter((u) => u.status === 'online').length} Online
            </span>
          </div>

          <div className="flex flex-1 max-w-sm items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <div className="relative">
                <Input 
                  placeholder="Add friend by username..." 
                  value={friendSearchQuery}
                  onChange={(e) => handleFriendSearch(e.target.value)}
                  className="h-8 pr-8 bg-secondary/50 border-none focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-xl text-xs font-bold"
                />
                {friendSearchQuery ? (
                  <button 
                    onClick={() => handleFriendSearch('')} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                )}
              </div>

              {/* Search results popover */}
              {showSearch && searchResults.length > 0 && (
                <div className="absolute z-20 mt-2 left-0 right-0 bg-popover border border-border rounded-2xl shadow-xl p-3 space-y-2 max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between gap-3 p-1.5 rounded-xl hover:bg-secondary transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img src={user.avatar} className="w-8 h-8 rounded-full object-cover border border-border" alt="" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{user.name || user.username}</p>
                          <p className="text-[10px] text-muted-foreground truncate">@{user.username}</p>
                        </div>
                      </div>
                      
                      {user.isFriend ? (
                        <span className="text-[9px] font-black uppercase text-green-500 tracking-widest mr-2">Friends</span>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={addingFriendId === user.id}
                          onClick={() => handleAddFriend(user.id)}
                          className="h-7 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
                        >
                          {addingFriendId === user.id ? 'Adding...' : '+ Add'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation arrows (only visible if we have online friends to scroll) */}
            {activeUsers.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  onClick={() => activeFriendsRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Scroll Left"
                >
                  <ChevronLeft size={16} />
                </button>
                <button 
                  onClick={() => activeFriendsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-border/50 hover:bg-secondary text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title="Scroll Right"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {activeUsers.length > 0 ? (
          <div 
            ref={activeFriendsRef}
            className="flex gap-5 overflow-x-auto pb-2 scrollbar-none snap-x"
            style={{ scrollbarWidth: 'none' }}
          >
            {activeUsers.map((u) => (
              <div 
                key={u.id} 
                className="flex flex-col items-center gap-2 min-w-[76px] snap-start group cursor-pointer text-center"
                onClick={() => navigate(`/profile/${u.id}`)}
              >
                <div className="relative">
                  <div className={cn(
                    "w-14 h-14 rounded-full overflow-hidden border-2 border-card shadow-sm ring-2 ring-border group-hover:ring-primary/40 transition-all duration-300 group-hover:scale-105",
                    u.status !== 'online' && "opacity-60 grayscale-[30%]"
                  )}>
                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  {u.status === 'online' ? (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-card" />
                  ) : (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-gray-400 rounded-full border-2 border-card" />
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
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground font-medium">
            No friends added yet. Search above to find and add friends!
          </div>
        )}
      </div>

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
                className="text-2xl sm:text-3xl lg:text-4xl leading-tight max-w-3xl font-black text-background dark:text-foreground"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                "{trendingRooms[0].title}"
              </h2>
              
              <p className="text-background/70 dark:text-muted-foreground text-sm max-w-xl line-clamp-2" style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                {trendingRooms[0].description}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-6 pt-4 border-t border-border/20">
              <div className="flex items-center gap-8">
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Voices</span>
                  <span className="text-base font-bold text-background dark:text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{trendingRooms[0]._count?.members || 0} Citizens</span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block text-[9px] font-black uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Activity</span>
                  <span className="text-base font-bold text-background dark:text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>{trendingRooms[0]._count?.messages || 0} Replies</span>
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
                activeNow: room.activeNow ?? 0
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={handleJoinRoom}
              onLeave={handleLeaveRoom}
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
                activeNow: room.activeNow ?? 0
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={handleJoinRoom}
              onLeave={handleLeaveRoom}
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
                activeNow: room.activeNow ?? 0
              }}
              onClick={(id) => navigate(`/room/${id}`)}
              onJoin={handleJoinRoom}
              onLeave={handleLeaveRoom}
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
