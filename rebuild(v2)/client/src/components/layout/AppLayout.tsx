import { useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Compass, MessageSquare, Bell, User as UserIcon, Hash, Activity } from 'lucide-react';
import { Navbar } from './Navbar';
import { RoomCard } from '@/components/shared/RoomCard';
import { useRooms } from '@/hooks/useRooms';
import { useAppSelector, useAppDispatch } from '@/store';
import { useNotifications } from '@/hooks/useNotifications';
import { setUnreadNotificationsCount } from '@/store/slices/uiSlice';
import { cn } from '@/utils/cn';

const CATEGORIES = ['All Topics', 'Politics', 'Technology', 'Economy', 'Environment', 'World Affairs', 'Science', 'Health', 'Culture', 'Sports'];

const sideNavLinks = [
  { to: '/home', icon: <Home size={18} />, label: 'Home' },
  { to: '/discover', icon: <Compass size={18} />, label: 'Discover' },
  { to: '/discussions', icon: <MessageSquare size={18} />, label: 'Discussions' },
  { to: '/notifications', icon: <Bell size={18} />, label: 'Notifications' },
  { to: '/profile', icon: <UserIcon size={18} />, label: 'Profile' },
];

function LeftSidebar() {
  const navigate = useNavigate();
  const unreadCount = useAppSelector((state) => state.ui.unreadNotificationsCount);
  const currentUser = useAppSelector((state) => state.auth.user);
  
  const { useTrendingRoomsQuery } = useRooms();
  const { data: trendingRooms = [], isLoading } = useTrendingRoomsQuery(5);

  const profilePath = currentUser ? `/profile/${currentUser.id}` : '/profile';

  if (isLoading) {
    return (
      <aside className="hidden lg:flex flex-col w-56 shrink-0 py-5 justify-center items-center border-r border-border/50 pr-6 h-full">
        <Activity className="animate-spin text-primary" size={24} />
      </aside>
    );
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/50 pr-6 h-full overflow-y-auto py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Navigation sidebar"
    >
      <div className="flex flex-col gap-6">
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            {sideNavLinks.map((link) => {
              const toPath = link.to === '/profile' ? profilePath : link.to;
              return (
                <li key={link.to}>
                  <NavLink
                    to={toPath}
                    className={({ isActive }: { isActive: boolean }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                        isActive
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary font-normal'
                      }`
                    }
                    style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
                  >
                    {link.icon}
                    {link.label}
                    {link.to === '/notifications' && unreadCount > 0 && (
                      <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div>
          <div className="flex items-center gap-2 px-3 mb-2">
            <span
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Categories
            </span>
          </div>
          <ul className="space-y-0.5">
            {CATEGORIES.slice(0, 8).map((cat) => (
              <li key={cat}>
                <Link
                  to={`/discover?category=${encodeURIComponent(cat)}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <Hash size={14} className="text-muted-foreground/50 shrink-0" />
                  {cat}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 px-3 mb-2">
            <span
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Trending
            </span>
          </div>
          <ul className="space-y-0.5">
            {trendingRooms.map((room) => (
              <li key={room.id}>
                <RoomCard
                  room={room}
                  compact
                  onClick={() => navigate(`/room/${room.id}`)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function AppLayout() {
  const location = useLocation();
  const isRoomPage = location.pathname.startsWith('/room/');
  const dispatch = useAppDispatch();

  // Dynamically sync unread notification count globally
  const { useNotificationsQuery } = useNotifications();
  const { data: notifications = [] } = useNotificationsQuery(40);

  useEffect(() => {
    const unread = notifications.filter((n) => !n.read).length;
    dispatch(setUnreadNotificationsCount(unread));
  }, [notifications, dispatch]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 w-full px-4 sm:px-6 overflow-hidden">
        <div className="flex h-full">
          {!isRoomPage && <LeftSidebar />}
          <main className={cn("flex-1 h-full overflow-y-auto py-5 min-w-0 animate-in fade-in duration-300 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden", !isRoomPage && "pl-6")} id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

