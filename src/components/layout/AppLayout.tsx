import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router';
import { Home, Compass, MessageSquare, Bell, User, Hash, Activity } from 'lucide-react';
import { Navbar } from './Navbar';
import { RoomCard } from '@/components/features/RoomCard';

const CATEGORIES = ['All Topics', 'Politics', 'Technology', 'Economy', 'Environment', 'World Affairs', 'Science', 'Health', 'Culture', 'Sports'];

const sideNavLinks = [
  { to: '/home', icon: <Home size={18} />, label: 'Home' },
  { to: '/discover', icon: <Compass size={18} />, label: 'Discover' },
  { to: '/discussions', icon: <MessageSquare size={18} />, label: 'Discussions' },
  { to: '/notifications', icon: <Bell size={18} />, label: 'Notifications' },
  { to: '/profile', icon: <User size={18} />, label: 'Profile' },
];

function LeftSidebar() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [roomsRes, notificationsRes] = await Promise.all([
          fetch('/api/rooms'),
          fetch('/api/notifications')
        ]);
        if (roomsRes.ok) {
          const roomsData = await roomsRes.json();
          setRooms(roomsData);
        }
        if (notificationsRes.ok) {
          const notificationsData = await notificationsRes.json();
          setNotifications(notificationsData);
        }
      } catch (error) {
        console.error('Error fetching layout data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const trendingRooms = rooms.filter((r) => r.trending).slice(0, 5);
  const unread = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <aside className="hidden lg:flex flex-col w-56 shrink-0 py-10 justify-center items-center">
        <Activity className="animate-spin text-primary" size={24} />
      </aside>
    );
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-56 shrink-0"
      aria-label="Navigation sidebar"
    >
      <div className="sticky top-[57px] flex flex-col gap-6 py-5">
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            {sideNavLinks.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary font-normal'
                    }`
                  }
                  style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
                >
                  {link.icon}
                  {link.label}
                  {link.to === '/notifications' && unread > 0 && (
                    <span className="ml-auto text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                      {unread}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
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
                  className="flex items-center gap-3 px-3 py-2 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Hash size={14} className="text-muted-foreground/50" />
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
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-5">
        <div className="flex gap-6">
          <LeftSidebar />
          <main className="flex-1 min-w-0" id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
