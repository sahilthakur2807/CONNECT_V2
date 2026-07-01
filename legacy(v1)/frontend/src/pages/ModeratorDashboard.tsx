import { useState, useEffect } from 'react';
import { Shield, Search, Filter, AlertTriangle, CheckCircle2, Clock, MoreVertical, UserX, ExternalLink, Activity, X } from 'lucide-react';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/utils/cn';
import { motion } from 'motion/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ModeratorDashboard() {
  const [reportSearch, setReportSearch] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('newsconnect_token');
        const headers: HeadersInit = token ? { 'Authorization': `Bearer ${token}` } : {};
        const [reportsRes, usersRes] = await Promise.all([
          fetch('/api/reports', { headers }),
          fetch('/api/users', { headers })
        ]);
        if (reportsRes.ok) setReports(await reportsRes.json());
        if (usersRes.ok) setUsers(await usersRes.json());
      } catch (error) {
        console.error("Failed to fetch moderator data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleResolveReport = async (reportId: string, newStatus: string) => {
    try {
      const token = localStorage.getItem('newsconnect_token');
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setReports(prev => prev.map(r => r.id === reportId ? updated : r));
      }
    } catch (e) {
      console.error('Failed to update report status:', e);
    }
  };

  const filteredReports = reports.filter(
    (r) =>
      reportSearch === '' ||
      r.reason.toLowerCase().includes(reportSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(reportSearch.toLowerCase())
  );

  return (
    <div className="space-y-10 pb-10 max-w-7xl mx-auto">
      <DashboardHeader 
        title="Moderator Command"
        description="The frontline of the network. Enforce quality, protect civility, and review reports."
        icon={<Shield size={24} />}
      />

      {/* High Impact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Pending Queue", value: reports.filter(r => r.status === 'pending').length.toString(), icon: AlertTriangle, color: "text-red-500", trend: "High Priority" },
          { label: "Decisions Today", value: "28", icon: CheckCircle2, color: "text-green-500", trend: "+12% vs avg" },
          { label: "Avg. Review Time", value: "8m", icon: Clock, color: "text-[#0d0d0d]", trend: "Optimal" },
          { label: "Active Guards", value: "6", icon: Shield, color: "text-primary", trend: "Live Coverage" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-black/[0.04] p-6 rounded-[32px] shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className={cn("p-2 rounded-xl bg-slate-50", stat.color)}>
                <stat.icon size={20} />
              </div>
              <span className="text-[10px] font-black text-[#888880] uppercase tracking-widest">{stat.trend}</span>
            </div>
            <div>
              <p className="text-3xl font-black text-[#0d0d0d]" style={{ fontFamily: "'Playfair Display', serif" }}>{stat.value}</p>
              <p className="text-[10px] font-bold text-[#888880] uppercase tracking-[0.2em] mt-1">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full md:max-w-xl">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20" />
            <Input 
              placeholder="Search the report queue..." 
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              className="pl-12 h-14 bg-white border-black/[0.04] rounded-2xl text-base shadow-sm focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
             <Button variant="outline" className="rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 h-14 px-8 flex-1 md:flex-none">
               <Filter size={16} className="mr-2" /> Advanced Filters
             </Button>
             <Button className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-14 px-8 flex-1 md:flex-none shadow-xl shadow-primary/20">
               Batch Actions
             </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex justify-center"><Activity className="animate-spin text-primary" /></div>
        ) : (
          <div className="bg-white border border-black/[0.04] rounded-[40px] overflow-hidden shadow-xl shadow-black/[0.02]">
            <Table>
              <TableHeader className="bg-[#f9fafb]">
                <TableRow className="border-black/[0.04] hover:bg-transparent h-16">
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] pl-8">Evidence & Source</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Category</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">Heat Level</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880]">State</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-[#888880] text-right pr-8">Control</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((rep) => {
                  const reported = users.find(u => u.id === rep.reportedUserId) || rep.reportedUser;
                  return (
                    <TableRow key={rep.id} className="border-black/[0.02] hover:bg-[#f9fafb] transition-colors h-24">
                      <TableCell className="pl-8 py-4">
                        <div className="space-y-2 max-w-sm">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-primary uppercase tracking-widest">USER @{reported?.username}</span>
                             <ExternalLink size={10} className="text-[#888880]" />
                          </div>
                          <p className="text-sm text-[#0d0d0d] line-clamp-2 italic font-medium leading-relaxed" style={{ fontFamily: "'Georgia', serif" }}>
                            "{rep.description}"
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-black text-[#0d0d0d] bg-[#f5f4ef] px-3 py-1.5 rounded-full uppercase tracking-widest border border-black/[0.04]">
                          {rep.reason}
                        </span>
                      </TableCell>
                      <TableCell>
                         <div className={cn(
                           "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-md w-fit flex items-center gap-2",
                           rep.severity === 'high' ? "bg-red-50 text-red-600 border border-red-100" : 
                           rep.severity === 'medium' ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-blue-50 text-blue-600 border border-blue-100"
                         )}>
                           <div className={cn("w-1.5 h-1.5 rounded-full", rep.severity === 'high' ? "bg-red-600 animate-pulse" : rep.severity === 'medium' ? "bg-orange-600" : "bg-blue-600")} />
                           {rep.severity}
                         </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <div className={cn(
                             "w-2 h-2 rounded-full",
                             rep.status === 'pending' ? "bg-orange-500 animate-pulse" : 
                             rep.status === 'resolved' ? "bg-green-500" : "bg-slate-400"
                           )} />
                           <span className="text-[10px] font-black text-[#0d0d0d] uppercase tracking-widest">{rep.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <div className="flex items-center justify-end gap-2">
                          <Button className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-4 shadow-lg shadow-primary/10">
                            Review Case
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/5">
                                <MoreVertical size={16} className="text-[#888880]" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-2xl border-black/[0.04]">
                              <DropdownMenuItem 
                                onClick={() => handleResolveReport(rep.id, 'resolved')}
                                className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-green-600 focus:text-green-600 focus:bg-green-50"
                              >
                                 <CheckCircle2 size={16} /> Resolve Case
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleResolveReport(rep.id, 'dismissed')}
                                className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-slate-600 focus:text-slate-600 focus:bg-slate-50"
                              >
                                 <X size={16} /> Dismiss Case
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-3 rounded-xl py-3 cursor-pointer font-bold text-xs uppercase tracking-widest text-red-600 focus:text-red-600 focus:bg-red-50">
                                 <UserX size={16} /> Suspend User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}