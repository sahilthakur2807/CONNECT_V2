import { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  BarChart2,
  Shield,
  Search,
  Activity,
  Globe,
  Lock,
  ArrowUpRight,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { Badge } from '@/components/features/Badge';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { cn } from '@/utils/cn';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'motion/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { connectSocket, getSocket } from '@/services/socket';

export function AdminDashboard() {
  const { user: currentUser } = useAuth();
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Role dialog states
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newRole, setNewRole] = useState('');
  const [updatingRole, setUpdatingRole] = useState(false);

  // System & User settings states
  const [settings, setSettings] = useState<any>({
    maintenance_mode: 'false',
    allow_registration: 'true',
    enable_websockets: 'true',
    rate_limit: '300',
    default_reputation: '10',
    max_friends: '100'
  });
  const [settingsLoading, setSettingsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const token = localStorage.getItem('newsconnect_token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const [usersRes, statsRes] = await Promise.all([
          fetch('/api/users', { headers }),
          fetch('/api/stats', { headers })
        ]);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setUsers(usersData);
        }
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();

    connectSocket();
    const socket = getSocket();
    const handleStatsUpdate = (data: any) => {
      setStats(data);
    };

    socket.on('stats_update', handleStatsUpdate);

    return () => {
      socket.off('stats_update', handleStatsUpdate);
    };
  }, []);

  useEffect(() => {
    async function fetchSettings() {
      if (currentUser?.role !== 'superadmin') return;
      try {
        const token = localStorage.getItem('newsconnect_token');
        const res = await fetch('/api/admin/settings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    }
    fetchSettings();
  }, [currentUser]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const token = localStorage.getItem('newsconnect_token');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleOpenRoleDialog = (user: any) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setIsRoleDialogOpen(true);
  };

  const handleUpdateRole = async () => {
    if (!selectedUser) return;
    setUpdatingRole(true);
    try {
      const token = localStorage.getItem('newsconnect_token');
      const res = await fetch(`/api/users/${selectedUser.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, role: updated.role, badges: updated.badges } : u));
        setIsRoleDialogOpen(false);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to update role');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      const token = localStorage.getItem('newsconnect_token');
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const canEditOrDeleteUser = (targetUser: any) => {
    if (currentUser?.role === 'superadmin') {
      return true;
    }
    if (currentUser?.role === 'admin') {
      return targetUser.role !== 'admin' && targetUser.role !== 'superadmin';
    }
    return false;
  };

  const filteredUsers = users.filter(
    (u) =>
      userSearch === '' ||
      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const moderators = users.filter((u) => u.role === 'moderator' || u.role === 'admin' || u.role === 'superadmin');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Activity className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto">
      <DashboardHeader 
        title="Admin Hub"
        description="The nervous system of the platform. Monitor vitals, orchestrate growth, and secure the network."
        icon={<Settings size={24} />}
        actions={
          <div className="flex gap-3">
             <Button variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 h-12 px-6">
                <Globe size={14} className="mr-2" /> Global Audit
              </Button>
              <Button className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8 shadow-xl shadow-primary/20">
                System Health
              </Button>
          </div>
        }
      />

      {/* Dynamic Health Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Citizens", value: (stats?.activeUsers || 0).toString(), icon: Users, color: "text-blue-500", trend: "Live" },
          { label: "Total Spheres", value: (stats?.totalCommunities || 0).toString(), icon: Globe, color: "text-primary", trend: "Active" },
          { label: "Network Pulse", value: (stats?.totalMessages || 0).toString(), icon: Activity, color: "text-green-500", trend: "Vitals" },
          { label: "Trust Guards", value: moderators.length.toString(), icon: Shield, color: "text-amber-500", trend: "Active" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-black/[0.04] p-8 rounded-[40px] shadow-sm space-y-4 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full blur-3xl -mr-12 -mt-12" />
            <div className="flex items-center justify-between relative z-10">
              <div className={cn("p-3 rounded-2xl bg-[#f9fafb]", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-md">
                <ArrowUpRight size={10} /> {stat.trend}
              </div>
            </div>
            <div className="relative z-10 pt-2">
              <p className="text-4xl font-black text-[#0d0d0d]" style={{ fontFamily: "'Playfair Display', serif" }}>{stat.value}</p>
              <p className="text-[10px] font-bold text-[#888880] uppercase tracking-[0.3em] mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="analytics" className="space-y-8">
        <div className="bg-white p-1.5 border border-black/[0.04] rounded-2xl inline-flex shadow-sm overflow-x-auto max-w-full">
          <TabsList className="bg-transparent border-none p-0 flex gap-1">
            <TabsTrigger value="analytics" className="rounded-xl px-6 h-11 data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white font-bold text-xs uppercase tracking-widest transition-all">
              <BarChart2 size={16} className="mr-2 animate-pulse" /> Analytics Pulse
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-6 h-11 data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white font-bold text-xs uppercase tracking-widest transition-all">
              <Users size={16} className="mr-2" /> Citizen Registry
            </TabsTrigger>
            {currentUser?.role === 'superadmin' && (
              <>
                <TabsTrigger value="system-settings" className="rounded-xl px-6 h-11 data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white font-bold text-xs uppercase tracking-widest transition-all">
                  <Settings size={16} className="mr-2" /> System Settings
                </TabsTrigger>
                <TabsTrigger value="user-settings" className="rounded-xl px-6 h-11 data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white font-bold text-xs uppercase tracking-widest transition-all">
                  <Users size={16} className="mr-2" /> Citizen Settings
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="settings" className="rounded-xl px-6 h-11 data-[state=active]:bg-[#0d0d0d] data-[state=active]:text-white font-bold text-xs uppercase tracking-widest transition-all">
              <Lock size={16} className="mr-2" /> Secure Config
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-black/[0.04] rounded-[40px] p-8 shadow-sm">
               <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xs font-black text-[#0d0d0d] uppercase tracking-[0.2em]">Activity Distribution</h3>
                 <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary">Last 7 Days</Button>
               </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.chartData || []}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity={1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#888880' }} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#888880' }} dx={-10} />
                    <Tooltip 
                      cursor={{ fill: '#f5f4ef', radius: 8 }}
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '16px' }}
                    />
                    <Bar dataKey="messages" fill="url(#barGradient)" radius={[10, 10, 0, 0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-black/[0.04] rounded-[40px] p-8 shadow-sm">
               <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xs font-black text-[#0d0d0d] uppercase tracking-[0.2em]">Citizen Onboarding</h3>
                 <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase text-primary">Growth Trends</Button>
               </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.chartData || []}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity={0.1} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#888880' }} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#888880' }} dx={-10} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '16px' }}
                    />
                    <Area type="monotone" dataKey="users" stroke="#dc2626" strokeWidth={4} fill="url(#areaGradient)" dot={{ r: 6, fill: '#dc2626', strokeWidth: 4, stroke: 'white' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-2">
            <div className="relative w-full md:max-w-xl">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" />
              <Input 
                placeholder="Search the citizen registry..." 
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="pl-12 h-14 bg-white border-black/[0.04] rounded-2xl text-base shadow-sm focus-visible:ring-primary/20"
              />
            </div>
            <Button className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 px-8 w-full md:w-auto shadow-xl shadow-primary/20">
              Onboard New User
            </Button>
          </div>

          <div className="bg-white border border-black/[0.04] rounded-[40px] overflow-hidden shadow-xl shadow-black/[0.02]">
            <Table>
              <TableHeader className="bg-[#f9fafb]">
                <TableRow className="border-black/[0.04] hover:bg-transparent h-16">
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] pl-8">Citizen Identity</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Designation</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Presence</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] text-right pr-8">Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="border-black/[0.02] hover:bg-[#f9fafb] transition-colors h-24">
                    <TableCell className="pl-8 py-4">
                      <div className="flex items-center gap-4">
                        <Avatar src={u.avatar} name={u.name} size="md" className="w-12 h-12 rounded-2xl ring-4 ring-slate-50" />
                        <div>
                          <p className="font-bold text-[#0d0d0d]">{u.name}</p>
                          <p className="text-[10px] font-black text-[#888880] uppercase tracking-widest">@{u.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.role as any} size="sm" className="rounded-lg uppercase tracking-widest text-[9px] h-6 px-3" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                         <div className={cn(
                           "w-2 h-2 rounded-full",
                           u.status === 'online' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-slate-300"
                         )} />
                         <span className="text-[10px] font-black text-[#0d0d0d] uppercase tracking-widest">{u.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-8">
                       <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-4">
                          Profile
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/5">
                              <MoreVertical size={18} className="text-[#888880]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-black/[0.04]">
                            {canEditOrDeleteUser(u) ? (
                              <>
                                <DropdownMenuItem 
                                  onClick={() => handleOpenRoleDialog(u)}
                                  className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest"
                                >
                                  <Edit size={16} /> Edit Privileges
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-red-600 focus:text-red-600 focus:bg-red-50"
                                >
                                  <Trash2 size={16} /> Purge Identity
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem disabled className="gap-3 rounded-xl py-3 font-bold text-xs uppercase tracking-widest text-muted-foreground/40">
                                No Privileges
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {currentUser?.role === 'superadmin' && (
          <>
            <TabsContent value="system-settings" className="space-y-6">
              <div className="bg-white border border-black/[0.04] rounded-[40px] p-8 shadow-sm max-w-2xl">
                <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>System Settings</h3>
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-2xl">
                    <div>
                      <Label className="font-bold text-sm block text-[#0d0d0d]">Maintenance Mode</Label>
                      <span className="text-[11px] text-muted-foreground">Put the entire platform into maintenance mode. Only super admins can access.</span>
                    </div>
                    <Switch 
                      checked={settings.maintenance_mode === 'true'} 
                      onCheckedChange={(checked) => setSettings({ ...settings, maintenance_mode: checked ? 'true' : 'false' })} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-2xl">
                    <div>
                      <Label className="font-bold text-sm block text-[#0d0d0d]">Allow Public Registration</Label>
                      <span className="text-[11px] text-muted-foreground">Toggles whether new users can register on the auth page.</span>
                    </div>
                    <Switch 
                      checked={settings.allow_registration === 'true'} 
                      onCheckedChange={(checked) => setSettings({ ...settings, allow_registration: checked ? 'true' : 'false' })} 
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-[#f9fafb] rounded-2xl">
                    <div>
                      <Label className="font-bold text-sm block text-[#0d0d0d]">Enable Real-time WebSockets</Label>
                      <span className="text-[11px] text-muted-foreground">Allows real-time notifications and message synchronization.</span>
                    </div>
                    <Switch 
                      checked={settings.enable_websockets === 'true'} 
                      onCheckedChange={(checked) => setSettings({ ...settings, enable_websockets: checked ? 'true' : 'false' })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-sm block text-[#0d0d0d]">API Rate Limit (requests/15min)</Label>
                    <Input 
                      type="number"
                      value={settings.rate_limit}
                      onChange={(e) => setSettings({ ...settings, rate_limit: e.target.value })}
                      className="bg-white border-black/[0.04] rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>

                  <Button type="submit" disabled={settingsLoading} className="rounded-2xl font-black uppercase text-xs tracking-widest h-12 px-8 shadow-xl shadow-primary/20 w-full cursor-pointer">
                    {settingsLoading ? 'Saving...' : 'Save System Settings'}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="user-settings" className="space-y-6">
              <div className="bg-white border border-black/[0.04] rounded-[40px] p-8 shadow-sm max-w-2xl">
                <h3 className="text-xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>Citizen Settings</h3>
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-sm block text-[#0d0d0d]">Default Reputation for New Citizens</Label>
                    <Input 
                      type="number"
                      value={settings.default_reputation}
                      onChange={(e) => setSettings({ ...settings, default_reputation: e.target.value })}
                      className="bg-white border-black/[0.04] rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-sm block text-[#0d0d0d]">Max Friend Limit</Label>
                    <Input 
                      type="number"
                      value={settings.max_friends}
                      onChange={(e) => setSettings({ ...settings, max_friends: e.target.value })}
                      className="bg-white border-black/[0.04] rounded-xl focus-visible:ring-primary/20"
                    />
                  </div>

                  <Button type="submit" disabled={settingsLoading} className="rounded-2xl font-black uppercase text-xs tracking-widest h-12 px-8 shadow-xl shadow-primary/20 w-full cursor-pointer">
                    {settingsLoading ? 'Saving...' : 'Save Citizen Settings'}
                  </Button>
                </form>
              </div>
            </TabsContent>
          </>
        )}

        <TabsContent value="settings" className="space-y-6">
          <div className="bg-white border border-black/[0.04] p-8 rounded-[40px] shadow-sm max-w-2xl">
             <h3 className="text-xs font-black text-[#0d0d0d] uppercase tracking-[0.2em] mb-4">Cryptographic Infrastructure</h3>
             <p className="text-sm text-[#888880] mb-6 leading-relaxed">
               Secure channels are established via ECDH P-384 key exchanges. Session credentials expire after 24 hours of inactivity.
             </p>
             <Button variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest border-2 h-10 px-6 cursor-pointer">
               Rotate Master Keys
             </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Role Assignment Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] p-6 border-black/[0.04]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Edit Privileges</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl">
                <Avatar src={selectedUser.avatar} name={selectedUser.name} size="sm" />
                <div>
                  <p className="font-bold text-sm text-[#0d0d0d]">{selectedUser.name}</p>
                  <p className="text-[10px] font-black text-[#888880] uppercase tracking-widest">@{selectedUser.username}</p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="font-bold text-sm block text-[#0d0d0d]">Designation Role</Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full h-11 px-3 bg-secondary/50 border border-black/[0.04] rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {currentUser?.role === 'superadmin' ? (
                  <>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </>
                ) : (
                  <>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} className="rounded-xl h-11 font-bold text-sm">Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={updatingRole} className="rounded-xl h-11 font-bold text-sm">
              {updatingRole ? 'Updating...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}