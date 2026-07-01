import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { MessageSquare, Verified, Pencil, Award, Star, Zap, Activity, Calendar } from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { Badge } from '@/components/features/Badge';
import { RoomCard } from '@/components/features/RoomCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { motion } from 'motion/react';
import { apiClient } from '@/services/api';
import { connectSocket, getSocket } from '@/services/socket';

export function UserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [user, setUser] = useState<any>(null);
  const [userMessages, setUserMessages] = useState<any[]>([]);
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', bio: '' });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        let userData: any = null;
        if (id) {
          const res = await apiClient.get(`/users/${id}`);
          userData = res.data;
        } else {
          const res = await apiClient.get('/auth/me');
          userData = res.data;
        }
        setUser(userData);

        if (userData) {
          const msgRes = await apiClient.get(`/users/${userData.id}/messages`);
          setUserMessages(msgRes.data);

          const roomRes = await apiClient.get(`/users/${userData.id}/rooms`);
          setUserRooms(roomRes.data);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();

    // Real-time: patch room counts in profile rooms list
    connectSocket();
    const socket = getSocket();
    const handleRoomStats = (data: { roomId: string; memberCount?: number; messageCount?: number; activeNow?: number }) => {
      setUserRooms(prev => prev.map(r => {
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
  }, [id]);

  const openEdit = () => {
    setEditForm({
      name: user?.name || '',
      bio: user?.bio || ''
    });
    setAvatarFile(null);
    setAvatarPreview(user?.avatar || '');
    setIsEditOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const res = await apiClient.post(`/rooms/${roomId}/join`);
      if (res.status === 200 || res.status === 201) {
        setUserRooms(prev => prev.map(r => {
          if (r.id !== roomId) return r;
          return {
            ...r,
            isJoined: true,
            _count: {
              ...r._count,
              members: (r._count?.members || 0) + 1
            }
          };
        }));
      }
    } catch (err) {
      console.error('Failed to join room from profile:', err);
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    try {
      const res = await apiClient.post(`/rooms/${roomId}/leave`);
      if (res.status === 200 || res.status === 201) {
        setUserRooms(prev => prev.map(r => {
          if (r.id !== roomId) return r;
          return {
            ...r,
            isJoined: false,
            _count: {
              ...r._count,
              members: Math.max(0, (r._count?.members || 0) - 1)
            }
          };
        }));
      }
    } catch (err) {
      console.error('Failed to leave room from profile:', err);
    }
  };

  const handleSaveProfile = async () => {
    try {
      let uploadedUser = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const res = await apiClient.post('/auth/avatar', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        uploadedUser = res.data;
      }

      const payload: any = { name: editForm.name, bio: editForm.bio };
      await updateProfile(payload);
      
      setUser((prev: any) => ({ ...prev, ...editForm, avatar: uploadedUser?.avatar || prev.avatar }));
      setIsEditOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Activity className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return <div className="text-center py-10 font-medium text-muted-foreground">User profile not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col items-center gap-4 mb-2">
              <Avatar src={avatarPreview} name={user?.name || user?.username} size="xl" className="w-20 h-20" />
              <div className="flex items-center gap-2">
                <Label htmlFor="avatar-upload" className="cursor-pointer text-xs font-bold text-primary hover:underline">
                  Change Photo
                </Label>
                <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">Handle</Label>
              <Input id="username" value={`@${user.username}`} disabled className="col-span-3 text-muted-foreground" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="bio" className="text-right mt-3">Bio</Label>
              <Textarea id="bio" value={editForm.bio} onChange={(e) => setEditForm({...editForm, bio: e.target.value})} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} type="submit">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden border-border/50 rounded-[40px] shadow-sm bg-card">
        {/* Banner with Red Gradient */}
        <div className="h-48 w-full bg-gradient-to-r from-red-600 via-red-500 to-red-800 relative" />

        {/* Profile Card Header Info */}
        <div className="px-8 pb-8 relative">
          {/* Avatar and Edit Profile row */}
          <div className="flex justify-between items-start -mt-20 mb-4">
            {/* Avatar overlapping banner */}
            <div className="relative p-1 bg-card rounded-full shadow-md inline-block">
              <Avatar 
                src={user.avatar} 
                name={user.name || user.username} 
                size="xl" 
                status={user.status}
                showStatus={true}
                className="w-32 h-32 border-4 border-card" 
              />
            </div>

            {/* Edit identity button */}
            {!id && (
              <Button onClick={openEdit} variant="outline" className="mt-24 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 h-10 px-5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
                <Pencil size={14} className="mr-2" /> Edit Identity
              </Button>
            )}
          </div>

          {/* User Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 
                  className="text-3xl text-foreground tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
                >
                  {user.name || user.username}
                </h2>
                {user.verified && <Verified size={18} className="text-primary shrink-0" />}
              </div>
              <p 
                className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                @{user.username}
              </p>
            </div>

            {/* Badges Row */}
            {user.badges && user.badges.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {user.badges.map((b: string) => (
                  <Badge key={b} variant={b.toLowerCase().replace(' ', '-') as any} size="sm" className="rounded-lg px-2.5 py-1" />
                ))}
              </div>
            )}

            {/* Bio */}
            <p className="text-sm text-muted-foreground font-medium leading-relaxed max-w-2xl italic" style={{ fontFamily: "'Georgia', serif" }}>
              "{user.bio || 'This user has not set a bio yet.'}"
            </p>

            {/* Joined Date */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Calendar size={14} className="text-muted-foreground/80" />
              <span>
                Joined {(() => {
                  if (!user.createdAt) return 'Unknown Date';
                  const d = new Date(user.createdAt);
                  return isNaN(d.getTime()) 
                    ? 'Unknown Date' 
                    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
                })()}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Stats Block - Row of 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Debates Joined */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-primary/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Debates Joined</p>
              <h3 className="text-3xl font-black text-foreground">{user._count?.rooms || 0}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-muted text-primary">
              <MessageSquare size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Reputation */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-amber-500/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Reputation</p>
              <h3 className="text-3xl font-black text-amber-500">{user.reputation || 0}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
              <Star size={24} />
            </div>
          </CardContent>
        </Card>

        {/* Contributions */}
        <Card className="border-border/50 rounded-3xl shadow-sm bg-card hover:border-blue-500/20 transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Contributions</p>
              <h3 className="text-3xl font-black text-blue-500">{(user._count?.messages || 0).toLocaleString()}</h3>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
              <Zap size={24} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Stacked Tabs & Activity History Area */}
      <div className="w-full">
        <Tabs defaultValue="activity" className="space-y-8">
          <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
            <TabsList className="bg-transparent border-none p-0">
              <TabsTrigger value="activity" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none font-bold text-xs uppercase tracking-widest transition-all">
                Activity History
              </TabsTrigger>
              <TabsTrigger value="badges" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none font-bold text-xs uppercase tracking-widest transition-all">
                Badges & Honors
              </TabsTrigger>
              <TabsTrigger value="rooms" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none font-bold text-xs uppercase tracking-widest transition-all">
                Joined Rooms
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="activity" className="space-y-4">
            {userMessages.length > 0 ? (
              userMessages.map((msg: any, i: number) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-8 bg-card border border-border/50 rounded-[32px] hover:border-primary/20 transition-all group cursor-pointer"
                  onClick={() => navigate(`/room/${msg.roomId}`)}
                >
                  <div className="flex items-start gap-6">
                    <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <MessageSquare size={20} className="text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="space-y-4 flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            Take in
                          </span>
                          <span className="text-xs font-bold text-foreground hover:text-primary cursor-pointer transition-colors underline decoration-border underline-offset-4">
                            {msg.room?.title}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-base text-muted-foreground leading-relaxed italic" style={{ fontFamily: "'Georgia', serif" }}>
                        "{msg.content}"
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic bg-card rounded-[40px] border border-border/50">
                No activity history to display.
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="badges" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {user.badges && user.badges.length > 0 ? (
              user.badges.map((badge: string) => (
                <div key={badge} className="p-8 bg-card border border-border/50 rounded-[32px] text-center space-y-4 hover:shadow-xl hover:shadow-primary/5 transition-all cursor-default">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                    <Award size={32} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-foreground">{badge}</h4>
                    <p className="text-xs text-muted-foreground">Awarded for exceptional contributions to the network.</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic col-span-3 bg-card rounded-[40px] border border-border/50">
                No badges awarded yet. Participate in discussions to earn badges!
              </div>
            )}
          </TabsContent>

          <TabsContent value="rooms" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {userRooms.length > 0 ? (
              userRooms.map((room: any) => (
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
                />
              ))
            ) : (
              <div className="py-20 text-center text-muted-foreground font-medium italic col-span-2 bg-card rounded-[40px] border border-border/50">
                Not joined any discussion rooms yet.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
