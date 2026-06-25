import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import {
  Bell,
  Search,
  Menu,
  LogOut,
  User,
  Settings,
  Shield,
  Home,
  LifeBuoy,
  MessageSquare,
  Sun,
  Moon
} from 'lucide-react';
import { Avatar } from '@/components/features/Avatar';
import { Badge } from '@/components/features/Badge';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/utils/cn';
import { useTheme } from '@/context/ThemeContext';

export function Navbar() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  const { user, token, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      }
    }
    fetchNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full h-16 flex items-center px-4">
         <div className="max-w-screen-xl mx-auto w-full flex items-center gap-4">
           <div className="animate-pulse bg-secondary rounded-xl w-10 h-10" />
           <div className="animate-pulse bg-secondary rounded-xl w-24 h-8" />
         </div>
      </header>
    );
  }

  if (!user) {
    if (token) {
      return (
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full h-16 flex items-center px-4 text-sm font-bold text-destructive justify-center">
          Reconnecting to server...
        </header>
      );
    }
    return null;
  }

  const navLinks = [
    { to: '/home', label: 'Home' },
    { to: '/discover', label: 'Discover' },
    { to: '/discussions', label: 'Discussions' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full">
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link
          to="/home"
          className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-1 transition-all hover:opacity-80 cursor-pointer"
          aria-label="Connect"
        >
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span 
              className="text-primary-foreground text-lg select-none"
              style={{ fontFamily: "'Hedvig Letters Serif', serif", fontWeight: 400 }}
            >
              N
            </span>
          </div>
          <span 
            className="text-xl text-foreground hidden sm:block tracking-tight"
            style={{ fontFamily: "'Hedvig Letters Serif', serif", fontWeight: 400 }}
          >
            Connect
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-6" aria-label="Main navigation">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'px-4 py-2 rounded-xl text-sm transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )
              }
              style={{ fontFamily: "'Hedvig Letters Serif', serif", fontWeight: 400 }}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Search */}
        <div
          className={cn(
            'hidden sm:flex flex-1 max-w-xs relative transition-all duration-500 ease-[0.22,1,0.36,1] ml-8',
            searchFocused && 'max-w-xl'
          )}
        >
          <Search
            size={18}
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none z-10",
              searchFocused ? "text-primary" : "text-[#888880]/50"
            )}
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Search communities, takes, or citizens..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate(`/discover?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
              }
            }}
            className="pl-12 h-12 bg-secondary/50 border-none focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-2xl text-sm font-bold placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="relative h-10 w-10 rounded-xl hover:bg-secondary transition-colors"
          >
            <Link
              to="/notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell size={20} className="text-muted-foreground" />
              {unreadCount > 0 && (
                <span
                  className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card"
                  aria-hidden="true"
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-xl hover:bg-secondary transition-colors"
          >
            {theme === 'dark' ? <Sun className="text-muted-foreground" /> : <Moon className="text-muted-foreground" />}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2.5 p-1.5 h-11 pr-3 rounded-xl hover:bg-secondary transition-all"
              >
                <Avatar
                  src={user.avatar || undefined}
                  name={user.name || user.username}
                  size="sm"
                  status={user.status}
                  showStatus
                />
                <div className="hidden lg:flex flex-col items-start leading-none gap-1">
                  <span className="text-sm font-bold text-foreground">
                    {(user.name || user.username).split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="14" 
                  height="14" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="lucide lucide-chevron-down hidden lg:block text-muted-foreground/50 transition-transform duration-200" 
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
              <DropdownMenuLabel className="p-3">
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatar || undefined} name={user.name || user.username} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">
                      {user.name || user.username}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3">
                  {user.verified && <Badge variant="verified" size="sm" className="h-5" />}
                  {user.role === 'moderator' && <Badge variant="moderator" size="sm" className="h-5" />}
                  {user.role === 'admin' && <Badge variant="admin" size="sm" className="h-5" />}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                <Link to="/profile" className="flex items-center gap-3 w-full p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <User size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Your Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                <Link to="/notifications" className="flex items-center gap-3 w-full p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Bell size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
              {(user.role === 'moderator' || user.role === 'admin') && (
                <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                  <Link to="/moderator" className="flex items-center gap-3 w-full p-2.5 text-purple-600 dark:text-purple-400 hover:bg-accent transition-colors">
                    <Shield size={16} />
                    <span className="font-medium text-sm">Moderator Panel</span>
                  </Link>
                </DropdownMenuItem>
              )}
              {user.role === 'admin' && (
                <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                  <Link to="/admin" className="flex items-center gap-3 w-full p-2.5 text-blue-600 dark:text-blue-400 hover:bg-accent transition-colors">
                    <Settings size={16} />
                    <span className="font-medium text-sm">Admin Settings</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                <Link to="/home" className="flex items-center gap-3 w-full p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <Home size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Home</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                <a href="mailto:support@example.com" className="flex items-center gap-3 w-full p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <LifeBuoy size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Support</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0 rounded-xl overflow-hidden">
                <a href="mailto:feedback@example.com" className="flex items-center gap-3 w-full p-2.5 hover:bg-accent hover:text-accent-foreground transition-colors">
                  <MessageSquare size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Feedback</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="p-2.5 rounded-xl cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30"
                onClick={() => { logout(); navigate('/'); }}
              >
                <div className="flex items-center gap-3">
                  <LogOut size={16} />
                  <span className="font-medium text-sm">Sign Out</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile menu toggle */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden rounded-xl h-10 w-10">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:w-80 p-0">
              <div className="flex flex-col h-full bg-card">
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <SheetTitle className="font-bold text-xl">Menu</SheetTitle>
                  <SheetDescription className="sr-only">Mobile navigation menu</SheetDescription>
                </div>
                <div className="p-6 space-y-6">
                  <div className="relative">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search..." className="pl-11 h-12 bg-secondary/50 border-none rounded-2xl" />
                  </div>
                  <nav className="flex flex-col gap-2">
                    {navLinks.map((link) => (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-bold transition-all',
                            isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary'
                          )
                        }
                      >
                        {link.label}
                      </NavLink>
                    ))}
                  </nav>
                </div>
                <div className="mt-auto p-6 border-t border-border bg-secondary/20">
                  <div className="flex items-center gap-4 mb-6">
                    <Avatar src={user.avatar || undefined} name={user.name || user.username} size="lg" />
                    <div>
                      <p className="font-bold text-lg text-foreground">{user.name || user.username}</p>
                      <p className="text-sm text-muted-foreground">@{user.username}</p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full h-12 rounded-2xl font-bold gap-3"
                    onClick={() => { logout(); navigate('/'); }}
                  >
                    <LogOut size={18} /> Sign Out
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
