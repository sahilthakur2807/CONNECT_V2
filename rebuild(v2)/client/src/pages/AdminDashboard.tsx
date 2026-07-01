import { useState } from 'react';
import { Settings, Users, BarChart2, Shield, Globe, Lock, ArrowUpRight, Activity } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAnalytics } from '@/hooks/useAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

export function AdminDashboard() {
  // const { user: currentUser } = useAuth();
  
  // Dates for platform metrics query (last 30 days)
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const { useAdminMetricsQuery, awardReputationMutation } = useAnalytics();
  const { data: metrics, isLoading } = useAdminMetricsQuery(thirtyDaysAgoStr, todayStr);

  // Settings states simulated in localStorage
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('newsconnect_settings');
    return saved ? JSON.parse(saved) : {
      maintenance_mode: false,
      allow_registration: true,
      enable_websockets: true,
      rate_limit: 300,
      default_reputation: 10,
    };
  });

  // Reputation dialog states
  const [repUserId, setRepUserId] = useState('');
  const [repAmount, setRepAmount] = useState(5);
  const [repReason, setRepReason] = useState('Outstanding Contribution');

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('newsconnect_settings', JSON.stringify(settings));
    toast.success('System settings saved and applied!');
  };

  const handleAwardReputation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repUserId.trim()) {
      toast.error('Please enter a target User ID');
      return;
    }
    try {
      await awardReputationMutation.mutateAsync({
        targetUserId: repUserId,
        amount: repAmount,
        reason: repReason,
      });
      toast.success('Reputation points successfully awarded!');
      setRepUserId('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to award reputation');
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading metrics...</p>
      </div>
    );
  }

  // Formatting metrics data for Recharts BarChart
  const chartData = [
    { name: 'Active (DAU)', count: metrics?.dau || 0 },
    { name: 'Registrations', count: metrics?.registrations || 0 },
    { name: 'Messages Volume', count: metrics?.messageVolume || 0 },
    { name: 'Mod Actions', count: metrics?.moderationCount || 0 },
  ];

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto font-sans">
      <DashboardHeader 
        title="Admin Settings"
        description="Site management, metrics analytics, global settings, and citizen reputation awards."
        icon={<Settings size={24} />}
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
        <StatCard label="Daily Active Users" value={metrics?.dau || 0} icon={<Users size={20} />} trend="Live Status" />
        <StatCard label="Registrations (30d)" value={metrics?.registrations || 0} icon={<Globe size={20} />} trend="New users" />
        <StatCard label="Message Volume" value={metrics?.messageVolume || 0} icon={<BarChart2 size={20} />} trend="Takes" />
        <StatCard label="Moderations" value={metrics?.moderationCount || 0} icon={<Shield size={20} />} trend="Enforcements" />
      </div>

      <div className="w-full">
        <Tabs defaultValue="analytics" className="space-y-8">
          <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
            <TabsList className="bg-transparent border-none p-0 flex gap-1">
              <TabsTrigger value="analytics" className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all">
                Analytics Pulse
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all">
                System Configurations
              </TabsTrigger>
              <TabsTrigger value="reputation" className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all">
                Reputation Control
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Analytics Chart Tab */}
          <TabsContent value="analytics" className="space-y-6 animate-in fade-in">
            <Card className="p-6 rounded-[32px] bg-card border border-border/50 shadow-sm">
              <CardHeader className="p-0 mb-6">
                <CardTitle className="text-lg font-bold">Platform Activity Distribution</CardTitle>
                <CardDescription>Visual metrics representing platform engagement and moderation activity for this billing cycle.</CardDescription>
              </CardHeader>
              <CardContent className="p-0 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)', borderRadius: '12px' }}
                      labelStyle={{ color: 'var(--foreground)', fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Settings Tab */}
          <TabsContent value="settings" className="space-y-6 animate-in fade-in">
            <Card className="p-8 rounded-[32px] bg-card border border-border/50 shadow-sm max-w-2xl">
              <CardHeader className="p-0 mb-6 border-b border-border pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <Lock size={20} className="text-primary" /> System Controls
                </CardTitle>
                <CardDescription>Configure global parameters. These metrics are simulated locally in localStorage.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <div className="space-y-0.5">
                      <label htmlFor="maint-mode" className="font-bold text-sm text-foreground">Maintenance Mode</label>
                      <p className="text-xs text-muted-foreground">Locks down the network for maintenance work.</p>
                    </div>
                    <input
                      id="maint-mode"
                      type="checkbox"
                      checked={settings.maintenance_mode}
                      onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
                      className="w-10 h-6 bg-switch-background rounded-full appearance-none relative checked:bg-primary transition-colors duration-200 cursor-pointer before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50">
                    <div className="space-y-0.5">
                      <label htmlFor="reg-mode" className="font-bold text-sm text-foreground">Allow Registrations</label>
                      <p className="text-xs text-muted-foreground">Toggles whether new users can sign up.</p>
                    </div>
                    <input
                      id="reg-mode"
                      type="checkbox"
                      checked={settings.allow_registration}
                      onChange={(e) => setSettings({ ...settings, allow_registration: e.target.checked })}
                      className="w-10 h-6 bg-switch-background rounded-full appearance-none relative checked:bg-primary transition-colors duration-200 cursor-pointer before:content-[''] before:absolute before:w-5 before:h-5 before:rounded-full before:bg-white before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="rate-limit" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">API Rate Limit (req/min)</label>
                    <Input 
                      id="rate-limit"
                      type="number" 
                      value={settings.rate_limit} 
                      onChange={(e) => setSettings({ ...settings, rate_limit: parseInt(e.target.value) || 60 })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="def-rep" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Default Starting Reputation</label>
                    <Input 
                      id="def-rep"
                      type="number" 
                      value={settings.default_reputation} 
                      onChange={(e) => setSettings({ ...settings, default_reputation: parseInt(e.target.value) || 10 })} 
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-2xl font-bold uppercase text-xs tracking-widest cursor-pointer shadow-lg shadow-primary/20">
                    Save Configurations
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reputation Control Tab */}
          <TabsContent value="reputation" className="space-y-6 animate-in fade-in">
            <Card className="p-8 rounded-[32px] bg-card border border-border/50 shadow-sm max-w-2xl">
              <CardHeader className="p-0 mb-6 border-b border-border pb-4">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                  <ArrowUpRight size={20} className="text-amber-500" /> Reputation Point Control
                </CardTitle>
                <CardDescription>Award or penalize reputation points to citizens in the network. Direct database hooks.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <form onSubmit={handleAwardReputation} className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="target-id" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Citizen ID</label>
                    <Input 
                      id="target-id"
                      value={repUserId}
                      onChange={(e) => setRepUserId(e.target.value)}
                      placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="rep-amount" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Amount (Positive or Negative)</label>
                    <Input 
                      id="rep-amount"
                      type="number"
                      value={repAmount}
                      onChange={(e) => setRepAmount(parseInt(e.target.value) || 0)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="rep-reason" className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Reason / Audit Log Summary</label>
                    <Textarea 
                      id="rep-reason"
                      value={repReason}
                      onChange={(e) => setRepReason(e.target.value)}
                      placeholder="e.g. Winner of the weekly Climate Debate room"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 rounded-2xl font-bold uppercase text-xs tracking-widest cursor-pointer shadow-lg shadow-primary/20">
                    Apply Reputation Adjustments
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
export default AdminDashboard;
