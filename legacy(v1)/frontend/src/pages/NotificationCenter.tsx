import { useEffect } from 'react';
import { Bell, MessageSquare, AtSign, TrendingUp, Shield, Heart, MoreHorizontal, CheckCircle2, Zap, Activity, UserPlus, UserCheck } from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/utils/cn';
import { motion } from 'motion/react';
import { useNotificationStore } from '@/store/useNotificationStore';
import { useNavigate } from 'react-router';
import { apiClient } from '@/services/api';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ICON_MAP: Record<string, any> = {
  mention: { icon: <AtSign size={16} />, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', label: 'Mention' },
  reply: { icon: <MessageSquare size={16} />, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', label: 'Reply' },
  reaction: { icon: <Heart size={16} />, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', label: 'Reaction' },
  room_update: { icon: <TrendingUp size={16} />, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', label: 'Update' },
  moderation: { icon: <Shield size={16} />, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', label: 'System' },
  friend_request: { icon: <UserPlus size={16} />, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Friend Request' },
  friend_accept: { icon: <UserCheck size={16} />, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400', label: 'Friend Added' },
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const {
    notifications,
    isLoading: loading,
    fetchNotifications,
    markRead,
    markAllRead
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (e) {
      console.error('Failed to mark all notifications read:', e);
    }
  };

  const handleAcceptRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    try {
      await apiClient.post('/users/accept-friend', { requesterId: n.triggerId });
      if (!n.read) {
        await markRead(n.id);
      }
      fetchNotifications();
    } catch (err) {
      console.error('Failed to accept friend request:', err);
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    try {
      await apiClient.post('/users/reject-friend', { requesterId: n.triggerId });
      if (!n.read) {
        await markRead(n.id);
      }
      fetchNotifications();
    } catch (err) {
      console.error('Failed to reject friend request:', err);
    }
  };

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.read) {
        await markRead(n.id);
      }
      if (n.roomId) {
        navigate(`/room/${n.roomId}`);
      }
    } catch (e) {
      console.error('Failed to handle notification click:', e);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'some time ago';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'some time ago';
    }
  };

  const renderNotificationList = (filteredList: any[]) => {
    if (filteredList.length === 0) {
      return (
        <div className="py-24 text-center space-y-6 bg-card rounded-[40px] border-2 border-dashed border-border">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
            <Bell size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Silence is golden</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
              Your inbox is empty. Why not start a debate or join a trending room?
            </p>
          </div>
          <Button onClick={() => navigate('/discover')} variant="default" className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
            Discover Conversations
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredList.map((n: any, i: number) => {
          const config = ICON_MAP[n.type] || ICON_MAP.moderation;
          const triggerUser = n.trigger;
          const avatarUrl = triggerUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${n.type}`;
          return (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card 
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "border-border/50 rounded-[32px] transition-all hover:border-primary/20 cursor-pointer overflow-hidden group bg-card shadow-sm",
                  !n.read && "bg-primary/[0.03] border-primary/20"
                )}
              >
                <CardContent className="p-6 flex gap-6 items-start">
                  <div className="relative shrink-0 pt-1">
                    <Avatar src={avatarUrl} name={n.title} size="md" className="w-12 h-12 rounded-2xl" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center shadow-sm",
                      config.color
                    )}>
                      <div className="scale-75">{config.icon}</div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                         <span 
                          className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {config.label}
                        </span>
                        <span className="text-border">|</span>
                        <time className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatTime(n.createdAt)}</time>
                       </div>
                       {!n.read && (
                          <div className="px-2 py-0.5 bg-primary text-primary-foreground text-[9px] font-black rounded uppercase tracking-widest">New</div>
                       )}
                    </div>
                    
                    <p className={cn(
                      "text-base leading-relaxed tracking-tight",
                      !n.read ? "text-foreground font-bold" : "text-muted-foreground font-medium"
                    )}>
                      {n.body}
                    </p>

                    <div className="flex items-center gap-4 pt-2">
                       {n.type === 'friend_request' ? (
                         <>
                           <Button 
                             onClick={(e) => handleAcceptRequest(e, n)} 
                             variant="default" 
                             size="sm" 
                             className="h-8 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white text-xs px-4"
                           >
                             Accept
                           </Button>
                           <Button 
                             onClick={(e) => handleRejectRequest(e, n)} 
                             variant="outline" 
                             size="sm" 
                             className="h-8 rounded-xl font-bold text-red-500 hover:bg-red-50 text-xs px-4"
                           >
                             Reject
                           </Button>
                         </>
                       ) : n.roomId ? (
                         <Button 
                           onClick={() => navigate(`/room/${n.roomId}`)}
                           variant="ghost" 
                           size="sm" 
                           className="h-8 rounded-xl font-bold text-primary text-xs hover:bg-primary/5 px-4"
                         >
                           View Discussion
                         </Button>
                       ) : null}
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal size={18} className="text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-2xl p-2 shadow-2xl border-border/50">
                      <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5 cursor-pointer font-bold text-xs uppercase tracking-widest">
                         <Zap size={14} /> Quick Reply
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5 cursor-pointer font-bold text-xs uppercase tracking-widest">
                         <Shield size={14} /> Mute Thread
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <Activity className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-10 max-w-5xl mx-auto">
      <DashboardHeader 
        title="Notifications"
        description="The pulse of your interactions across the network."
        icon={<Bell size={24} />}
        actions={
          <Button onClick={handleMarkAllRead} variant="ghost" size="sm" className="font-black uppercase text-[10px] tracking-widest text-primary hover:bg-primary/5 rounded-xl h-10 px-6">
            <CheckCircle2 size={14} className="mr-2" /> Mark all as read
          </Button>
        }
      />

      <Tabs defaultValue="all" className="space-y-8">
        <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
          <TabsList className="bg-transparent border-none p-0">
            {['all', 'mentions', 'replies', 'system'].map((tab) => (
              <TabsTrigger 
                key={tab} 
                value={tab} 
                className="rounded-xl px-8 h-10 data-[state=active]:bg-foreground data-[state=active]:text-background font-bold text-xs uppercase tracking-widest transition-all"
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="all" className="space-y-4">
          {renderNotificationList(notifications)}
        </TabsContent>
        
        <TabsContent value="mentions" className="space-y-4">
          {renderNotificationList(notifications.filter(n => n.type === 'mention'))}
        </TabsContent>

        <TabsContent value="replies" className="space-y-4">
          {renderNotificationList(notifications.filter(n => n.type === 'reply'))}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {renderNotificationList(notifications.filter(n => n.type === 'moderation'))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
