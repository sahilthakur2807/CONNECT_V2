import { useState } from 'react';
import { Shield, Search, AlertTriangle, CheckCircle2, Clock, MoreVertical, UserX, ExternalLink, Activity, X } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/cn';
import { useModeration } from '@/hooks/useModeration';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export function ModeratorDashboard() {
  const [reportSearch, setReportSearch] = useState('');
  
  const { useReportsQuery, resolveReportMutation, applyActionMutation, assignReportMutation } = useModeration();
  const { data: reports = [], isLoading } = useReportsQuery();

  // Suspend/Enforcement Modal States
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendUserId, setSuspendUserId] = useState('');
  const [suspendUsername, setSuspendUsername] = useState('');
  const [enforceType, setEnforceType] = useState<'warn' | 'mute' | 'suspend' | 'ban'>('mute');
  const [enforceReason, setEnforceReason] = useState('Harassment / Civility Violation');
  const [enforceDays, setEnforceDays] = useState(3);

  // Subscribe to real-time moderation events (report created/assigned/resolved)
  useSocketEvents();

  const handleResolveReport = async (reportId: string, status: string) => {
    try {
      await resolveReportMutation.mutateAsync({ reportId, status });
      toast.success(`Case marked as ${status}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update case');
    }
  };

  const handleAssignReport = async (reportId: string) => {
    try {
      await assignReportMutation.mutateAsync(reportId);
      toast.success('Case assigned to you');
    } catch (e: any) {
      toast.error(e.message || 'Failed to assign case');
    }
  };

  const openSuspendModal = (userId: string, username: string) => {
    setSuspendUserId(userId);
    setSuspendUsername(username);
    setSuspendOpen(true);
  };

  const handleApplyEnforcement = async () => {
    if (!suspendUserId || !enforceReason.trim()) {
      toast.error('Please enter a valid reason.');
      return;
    }
    try {
      await applyActionMutation.mutateAsync({
        targetUserId: suspendUserId,
        actionType: enforceType,
        reason: enforceReason,
        durationDays: enforceType !== 'warn' ? enforceDays : undefined,
      });
      setSuspendOpen(false);
      setEnforceReason('Harassment / Civility Violation');
      toast.success(`Enforcement action (${enforceType}) applied successfully`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to apply enforcement');
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      reportSearch === '' ||
      r.reason.toLowerCase().includes(reportSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(reportSearch.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading cases...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto font-sans">
      <DashboardHeader 
        title="Moderator Command"
        description="The frontline of the network. Enforce quality, protect civility, and review reports."
        icon={<Shield size={24} />}
      />

      {/* High Impact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in duration-300">
        {[
          { label: "Pending Queue", value: reports.filter(r => r.status === 'pending').length.toString(), icon: AlertTriangle, color: "text-red-500", trend: "High Priority" },
          { label: "Resolved Cases", value: reports.filter(r => r.status === 'resolved').length.toString(), icon: CheckCircle2, color: "text-green-500", trend: "Processed" },
          { label: "Avg. Review Time", value: "8m", icon: Clock, color: "text-foreground", trend: "Optimal" },
          { label: "Active Guards", value: "6", icon: Shield, color: "text-primary", trend: "Live Coverage" },
        ].map((stat, i) => (
          <Card key={i} className="p-6 rounded-[32px] shadow-sm space-y-4 bg-card">
            <div className="flex items-center justify-between">
              <div className={cn("p-2 rounded-xl bg-slate-50 dark:bg-muted", stat.color)}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-[#888880] uppercase tracking-widest">{stat.trend}</span>
            </div>
            <div>
              <p className="text-3xl font-black text-foreground font-serif">{stat.value}</p>
              <p className="text-[10px] font-bold text-[#888880] uppercase tracking-[0.2em] mt-1">{stat.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full md:max-w-xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
            <Input 
              placeholder="Search the report queue..." 
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="pl-12 h-14 bg-secondary/50 border-none rounded-2xl text-base shadow-sm focus-visible:ring-primary/20"
            />
          </div>
        </div>

        {/* Reports Table Grid */}
        <div className="bg-card border border-border/50 rounded-[40px] overflow-hidden shadow-xl shadow-black/[0.02] animate-in fade-in duration-300">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted/50 border-b border-border h-16">
                <th className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] pl-8">Evidence & Source</th>
                <th className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Category</th>
                <th className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Heat Level</th>
                <th className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">State</th>
                <th className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] text-right pr-8">Control</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((rep) => (
                <tr key={rep.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors h-24">
                  <td className="pl-8 py-4">
                    <div className="space-y-2 max-w-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                          USER @{rep.reportedUser?.username || 'unknown'}
                        </span>
                        <ExternalLink size={10} className="text-muted-foreground" />
                      </div>
                      <p className="text-sm text-foreground line-clamp-2 italic font-medium leading-relaxed font-serif">
                        "{rep.description}"
                      </p>
                    </div>
                  </td>
                  <td>
                    <span className="text-[10px] font-black text-foreground bg-muted px-3 py-1.5 rounded-full uppercase tracking-widest border border-border">
                      {rep.reason}
                    </span>
                  </td>
                  <td>
                    <div className={cn(
                      "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-md w-fit flex items-center gap-2",
                      rep.severity === 'high' ? "bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/20" : 
                      rep.severity === 'medium' ? "bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-950/20" : "bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", rep.severity === 'high' ? "bg-red-600 animate-pulse" : rep.severity === 'medium' ? "bg-orange-600" : "bg-blue-600")} />
                      {rep.severity}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        rep.status === 'pending' ? "bg-orange-500 animate-pulse" : 
                        rep.status === 'resolved' ? "bg-green-500" : "bg-slate-400"
                      )} />
                      <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{rep.status}</span>
                    </div>
                  </td>
                  <td className="text-right pr-8">
                    <div className="flex items-center justify-end gap-2">
                      {rep.status === 'pending' && (
                        <Button 
                          onClick={() => handleAssignReport(rep.id)}
                          className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-4 shadow-lg shadow-primary/10 cursor-pointer"
                        >
                          Claim Case
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-secondary cursor-pointer">
                            <MoreVertical size={16} className="text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 rounded-2xl p-2 shadow-2xl border-border/50">
                          <DropdownMenuItem 
                            onClick={() => handleResolveReport(rep.id, 'resolved')}
                            className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-green-600"
                          >
                            <CheckCircle2 size={16} /> Resolve Case
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleResolveReport(rep.id, 'dismissed')}
                            className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-slate-600"
                          >
                            <X size={16} /> Dismiss Case
                          </DropdownMenuItem>
                          {rep.reportedUserId && (
                            <DropdownMenuItem 
                              onClick={() => openSuspendModal(rep.reportedUserId!, rep.reportedUser?.username || 'user')}
                              className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-red-600"
                            >
                              <UserX size={16} /> Enforce Restraint
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-20 text-center text-muted-foreground font-medium text-sm">
                    No violation reports currently pending moderator review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enforcement Control Overlay */}
      {suspendOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-card text-card-foreground rounded-[32px] max-w-lg w-full p-8 space-y-6 relative shadow-2xl border border-border/50">
            <button onClick={() => setSuspendOpen(false)} className="absolute top-6 right-6 text-muted-foreground hover:text-foreground cursor-pointer">
              <X size={20} />
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Apply Enforcement</h2>
              <p className="text-sm text-muted-foreground">Restrict user access controls on @{suspendUsername}.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="enforce-type" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Action Type</label>
                <select
                  id="enforce-type"
                  value={enforceType}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEnforceType(e.target.value as any)}
                  className="w-full h-10 px-3 bg-secondary/50 rounded-lg border border-border outline-none focus:ring-2 focus:ring-primary/15"
                >
                  <option value="warn">Issue Warning</option>
                  <option value="mute">Mute User (Read-Only)</option>
                  <option value="suspend">Suspend Account</option>
                  <option value="ban">Permanent Ban</option>
                </select>
              </div>

              {enforceType !== 'warn' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label htmlFor="enforce-days" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Duration (Days)</label>
                  <Input
                    id="enforce-days"
                    type="number"
                    min={1}
                    max={365}
                    value={enforceDays}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEnforceDays(parseInt(e.target.value) || 1)}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="enforce-reason" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reason</label>
                <Textarea
                  id="enforce-reason"
                  placeholder="Describe the reason for applying restraint..."
                  value={enforceReason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEnforceReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setSuspendOpen(false)} className="cursor-pointer">
                Cancel
              </Button>
              <Button onClick={handleApplyEnforcement} className="cursor-pointer">
                Enforce Stance
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ModeratorDashboard;
