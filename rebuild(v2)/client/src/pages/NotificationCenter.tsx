import { Bell, MessageSquare, AtSign, TrendingUp, Shield, Heart, CheckCircle2, UserPlus, UserCheck, Activity } from 'lucide-react';
import { Avatar } from '@/components/shared/Avatar';
import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/utils/cn';
import { useNavigate, Link } from 'react-router-dom';
import { useNotifications } from '@/hooks/useNotifications';
import { useSocial } from '@/hooks/useSocial';
import { toast } from 'sonner';

const ICON_MAP: Record<string, any> = {
  mention: { icon: <AtSign size={16} />, color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', label: 'Mention' },
  reply: { icon: <MessageSquare size={16} />, color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400', label: 'Reply' },
  reaction: { icon: <Heart size={16} />, color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400', label: 'Reaction' },
  room_update: { icon: <TrendingUp size={16} />, color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', label: 'Update' },
  moderation: { icon: <Shield size={16} />, color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', label: 'System' },
  'friend.request.sent': { icon: <UserPlus size={16} />, color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Friend Request' },
  'friend.request.accepted': { icon: <UserCheck size={16} />, color: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400', label: 'Friend Added' },
};

export function NotificationCenter() {
  const navigate = useNavigate();
  const { useNotificationsQuery, markReadMutation, markAllReadMutation } = useNotifications();
  const { usePendingRequestsQuery, useFriendsQuery, acceptFriendRequestMutation, rejectFriendRequestMutation } = useSocial();

  const { data: notifications = [], isLoading } = useNotificationsQuery(40);
  const { data: pendingRequests = [] } = usePendingRequestsQuery();
  const { data: friendsList = [] } = useFriendsQuery();

  const handleMarkAllRead = async () => {
    try {
      await markAllReadMutation.mutateAsync();
      toast.success('All notifications marked as read!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update notifications');
    }
  };

  const handleAcceptRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    if (!n.referenceId) return;
    try {
      await acceptFriendRequestMutation.mutateAsync(n.referenceId);
      if (!n.read) {
        await markReadMutation.mutateAsync(n.id);
      }
      toast.success('Friend request accepted!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (e: React.MouseEvent, n: any) => {
    e.stopPropagation();
    if (!n.referenceId) return;
    try {
      await rejectFriendRequestMutation.mutateAsync(n.referenceId);
      if (!n.read) {
        await markReadMutation.mutateAsync(n.id);
      }
      toast.info('Friend request rejected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject request');
    }
  };

  const handleNotificationClick = async (n: any) => {
    try {
      if (!n.read) {
        await markReadMutation.mutateAsync(n.id);
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
      return (
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' - ' +
        date.toLocaleDateString([], { month: 'short', day: 'numeric' })
      );
    } catch {
      return 'some time ago';
    }
  };

  const renderNotificationList = (filteredList: any[]) => {
    if (filteredList.length === 0) {
      return (
        <div className="py-24 text-center space-y-6 bg-card rounded-[40px] border-2 border-dashed border-border animate-in fade-in">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
            <Bell size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Silence is golden</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto font-medium">
              Your inbox is empty. Why not start a debate or join a trending room?
            </p>
          </div>
          <Button onClick={() => navigate('/discover')} variant="default" className="rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 cursor-pointer">
            Discover Conversations
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredList.map((n: any) => {
          const config = ICON_MAP[n.type] || ICON_MAP.moderation;
          const triggerUser = n.trigger;
          const avatarUrl = triggerUser?.avatar || undefined;
          return (
            <div key={n.id} className="animate-in fade-in duration-200">
              <Card 
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "border-border/50 rounded-[32px] transition-all hover:border-primary/20 cursor-pointer overflow-hidden group bg-card shadow-sm",
                  !n.read && "bg-primary/[0.03] border-primary/20"
                )}
              >
                <CardContent className="p-6 flex gap-6 items-center justify-between">
                  <div className="flex gap-6 items-start min-w-0 flex-1">
                    <div className="relative shrink-0 pt-1">
                      <Avatar src={avatarUrl} name={n.title || 'System'} size="md" />
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-card flex items-center justify-center shadow-sm",
                        config.color
                      )}>
                        <div className="scale-75">{config.icon}</div>
                      </div>
                    </div>

                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          {config.label}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground/60">{formatTime(n.createdAt)}</span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
                          {n.title}
                        </h4>
                        <div className="text-xs text-muted-foreground font-medium leading-relaxed">
                          {n.type === 'friend.request.sent' && triggerUser ? (
                            <span>
                              You received a friend request from{' '}
                              <Link
                                to={`/profile/${triggerUser.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary font-bold hover:underline"
                              >
                                @{triggerUser.username}
                              </Link>
                            </span>
                          ) : n.type === 'friend.request.accepted' && triggerUser ? (
                            <span>
                              Your friend request to{' '}
                              <Link
                                to={`/profile/${triggerUser.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary font-bold hover:underline"
                              >
                                @{triggerUser.username}
                              </Link>{' '}
                              was accepted
                            </span>
                          ) : (
                            n.body
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {n.type === 'friend.request.sent' && (
                    <div className="flex gap-2 shrink-0 ml-4">
                      {n.status === 'accepted' ? (
                        <span className="text-[9px] font-black uppercase text-green-500 tracking-widest border border-green-500/20 bg-green-500/5 px-2.5 py-1 rounded-lg animate-in fade-in duration-300">
                          Accepted
                        </span>
                      ) : n.status === 'declined' ? (
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest border border-border/40 bg-muted/30 px-2.5 py-1 rounded-lg animate-in fade-in duration-300">
                          Declined
                        </span>
                      ) : pendingRequests.some((r) => r.id === n.referenceId) ? (
                        <>
                          <Button
                            size="sm"
                            onClick={(e) => handleAcceptRequest(e, n)}
                            className="h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleRejectRequest(e, n)}
                            className="h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-secondary cursor-pointer border border-border/50 animate-in fade-in zoom-in-95 duration-200"
                          >
                            Decline
                          </Button>
                        </>
                      ) : triggerUser && friendsList.some((f) => f.id === triggerUser.id) ? (
                        <span className="text-[9px] font-black uppercase text-green-500 tracking-widest border border-green-500/20 bg-green-500/5 px-2.5 py-1 rounded-lg animate-in fade-in duration-300">
                          Accepted
                        </span>
                      ) : (
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest border border-border/40 bg-muted/30 px-2.5 py-1 rounded-lg animate-in fade-in duration-300">
                          Declined
                        </span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  const unreadNotifications = notifications.filter((n) => !n.read);

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Activity className="animate-spin mx-auto text-primary" size={32} />
        <p className="mt-4 text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-10 font-sans">
      <DashboardHeader 
        title="Notifications"
        description="Stay updated with replies, mentions, and friend activities."
        icon={<Bell size={24} />}
        actions={
          unreadNotifications.length > 0 && (
            <Button onClick={handleMarkAllRead} className="rounded-xl font-bold h-10 px-4 cursor-pointer gap-2">
              <CheckCircle2 size={16} /> Mark all read
            </Button>
          )
        }
      />

      <div className="w-full">
        <Tabs defaultValue="all" className="space-y-6">
          <div className="bg-card p-1.5 border border-border/50 rounded-2xl inline-flex shadow-sm">
            <TabsList className="bg-transparent border-none p-0 flex gap-1">
              <TabsTrigger value="all" className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all">
                All ({notifications.length})
              </TabsTrigger>
              <TabsTrigger value="unread" className="rounded-xl px-8 h-10 font-bold text-xs uppercase tracking-widest transition-all">
                Unread ({unreadNotifications.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="space-y-4">
            {renderNotificationList(notifications)}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {renderNotificationList(unreadNotifications)}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
export default NotificationCenter;
