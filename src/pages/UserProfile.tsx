import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { User, MessageSquare, Verified, Pencil, Award, Star, Zap, ShieldCheck, Activity } from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { Badge } from '@/components/features/Badge';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { RoomCard } from '@/components/features/RoomCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';
import { motion } from 'motion/react';

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
        const token = localStorage.getItem('newsconnect_token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};

        let userData: any = null;
        if (id) {
          const res = await fetch(`/api/users/${id}`);
          if (res.ok) userData = await res.json();
        } else {
          const res = await fetch('/api/auth/me', { headers });
          if (res.ok) userData = await res.json();
        }
        setUser(userData);

        if (userData) {
          const msgRes = await fetch(`/api/users/${userData.id}/messages`);
          if (msgRes.ok) setUserMessages(await msgRes.json());

          const roomRes = await fetch(`/api/users/${userData.id}/rooms`);
          if (roomRes.ok) setUserRooms(await roomRes.json());
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUserData();
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

  const handleSaveProfile = async () => {
    try {
      let uploadedUser = null;
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const token = localStorage.getItem('newsconnect_token');
        const res = await fetch('/api/auth/avatar', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (res.ok) {
          uploadedUser = await res.json();
        }
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

  const STATS = [
    { label: 'Debates Joined', value: user._count?.rooms || 0, icon: MessageSquare, color: 'text-primary' },
    { label: 'Reputation', value: user.reputation || 0, icon: Star, color: 'text-amber-500' },
    { label: 'Contributions', value: (user._count?.messages || 0).toLocaleString(), icon: Zap, color: 'text-blue-500' },
    { label: 'Verified Cred', value: `Level ${Math.floor((user.reputation || 0) / 100) + 1}`, icon: ShieldCheck, color: 'text-green-500' },
  ];

  return (
    <div className="space-y-10 pb-10">
      <DashboardHeader 
        title={id ? `${user.name || user.username}'s Profile` : "Your Profile"}
        description="The record of user presence and reputation within the network."
        icon={<User size={24} />}
        actions={
          !id && (
            <Button onClick={openEdit} variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 h-11 px-6 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all">
              <Pencil size={14} className="mr-2" /> Edit Identity
            </Button>
          )
        }
      />

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar - Identity */}
        <div className="lg:col-span-1 space-y-8">
          <Card className="overflow-hidden border-border/50 rounded-[40px] shadow-sm bg-card">
            <div className="h-28 bg-foreground dark:bg-secondary relative">
              <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 p-2 bg-card rounded-full">
                <Avatar src={user.avatar} name={user.name || user.username} size="xl" className="w-24 h-24 border-4 border-card" />
              </div>
            </div>
            <CardContent className="pt-16 pb-10 text-center px-8">
              <div className="space-y-1 mb-6">
                <h2 
                  className="text-2xl text-foreground tracking-tight"
                  style={{ fontFamily: "'Playfair Display', serif", fontWeight: 900 }}
                >
                  {user.name || user.username}
                </h2>
                <div className="flex items-center justify-center gap-2">
                   <p 
                    className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    @{user.username}
                  </p>
                  {user.verified && <Verified size={14} className="text-primary" />}
                </div>
              </div>

              <p className="text-sm text-muted-foreground font-medium leading-relaxed mb-8 italic" style={{ fontFamily: "'Georgia', serif" }}>
                "{user.bio || 'This user has not set a bio yet.'}"
              </p>

              <div className="flex flex-wrap justify-center gap-2">
                {user.badges && user.badges.map((b: string) => (
                  <Badge key={b} variant={b.toLowerCase().replace(' ', '-') as any} size="sm" className="rounded-lg px-2.5 py-1" />
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
             <h3 
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-4"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Network Presence
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {STATS.map((stat, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-card border border-border/50 rounded-2xl shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl bg-muted", stat.color)}>
                      <stat.icon size={16} />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{stat.label}</span>
                  </div>
                  <span className="text-sm font-black text-foreground">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Activity Area */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="activity" className="space-y-8">
            <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
              <TabsList className="bg-transparent border-none p-0">
                <TabsTrigger value="activity" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background font-bold text-xs uppercase tracking-widest transition-all">
                  Activity History
                </TabsTrigger>
                <TabsTrigger value="badges" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background font-bold text-xs uppercase tracking-widest transition-all">
                  Badges & Honors
                </TabsTrigger>
                <TabsTrigger value="rooms" className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background font-bold text-xs uppercase tracking-widest transition-all">
                  Joined Rooms
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="activity" className="space-y-4">
              {userMessages.length > 0 ? (
                userMessages.map((msg: any, i: number) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
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
            
            <TabsContent value="badges" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                      activeNow: Math.ceil((room._count?.members || 1) * 0.4)
                    }}
                    onClick={(id) => navigate(`/room/${id}`)}
                    onJoin={(id) => navigate(`/room/${id}`)}
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
    </div>
  );
}
