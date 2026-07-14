import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { apiClient } from "@/services/apiClient";
import {
  BellIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  HomeIcon,
  SunIcon,
  MoonIcon,
  XMarkIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "@/components/shared/Avatar";
import { Badge } from "@/components/shared/Badge";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/utils/cn";
import { useTheme } from "@/context/ThemeContext";
import { useAppSelector } from "@/store";
import { useNotifications } from "@/hooks/useNotifications";
import { toast } from "sonner";

export function Navbar() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, accessToken, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [hasModeratedCommunities, setHasModeratedCommunities] = useState(false);
  const [hasAdminCommunities, setHasAdminCommunities] = useState(false);

  useEffect(() => {
    if (user) {
      apiClient.get("/communities/moderated")
        .then(res => {
          const list = res.data.data || [];
          setHasModeratedCommunities(list.length > 0);
          setHasAdminCommunities(list.some(c => ["OWNER", "ADMIN"].includes(c.myRole?.toUpperCase())));
        })
        .catch(err => console.error("Failed to load moderated communities in navbar:", err));
    }
  }, [user]);

  const unreadCount = useAppSelector(
    (state) => state.ui.unreadNotificationsCount,
  );

  const { useNotificationsQuery, markReadMutation, markAllReadMutation } = useNotifications();
  const { data: notifications = [], isLoading: isLoadingNotifications } = useNotificationsQuery(40);

  const navLinks = [
    { to: "/home", label: "Home" },
    { to: "/communities", label: "Communities" },
    { to: "/world-chat", label: "World chat" },
  ];

  if (isLoading) {
    return (
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full h-16 flex items-center px-6">
        <div className="w-full flex items-center gap-4">
          <div className="animate-pulse bg-secondary rounded-xl w-10 h-10" />
          <div className="animate-pulse bg-secondary rounded-xl w-24 h-8" />
        </div>
      </header>
    );
  }

  if (!user) {
    if (accessToken) {
      return (
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full h-16 flex items-center px-4 text-sm font-bold text-destructive justify-center">
          Reconnecting to server...
        </header>
      );
    }
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b border-border w-full">
        <div className="w-full px-6 h-16 flex items-center gap-4">
          {/* Logo */}
          <Link
            to="/home"
            className="flex items-center gap-2.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-1 transition-all hover:opacity-80 cursor-pointer"
            aria-label="Connect"
          >
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 animate-in fade-in duration-500">
              <span
                className="text-primary-foreground text-lg select-none"
                style={{
                  fontFamily: "'Hedvig Letters Serif', serif",
                  fontWeight: 400,
                }}
              >
                N
              </span>
            </div>
            <span
              className="text-xl text-foreground hidden sm:block tracking-tight"
              style={{
                fontFamily: "'Hedvig Letters Serif', serif",
                fontWeight: 400,
              }}
            >
              Connect
            </span>
          </Link>

          {/* Desktop nav */}
          <nav
            className="hidden md:flex items-center gap-1 ml-6"
            aria-label="Main navigation"
          >
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    "px-4 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )
                }
                style={{
                  fontFamily: "'Hedvig Letters Serif', serif",
                  fontWeight: 400,
                }}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Search */}
          <div
            className={cn(
              "hidden sm:flex flex-1 max-w-xs relative transition-all duration-500 ease-[0.22,1,0.36,1] ml-8",
              searchFocused && "max-w-xl",
            )}
          >
            <MagnifyingGlassIcon
              className={cn(
                "w-[18px] h-[18px] absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none z-10",
                searchFocused ? "text-primary" : "text-muted-foreground/50",
              )}
              aria-hidden="true"
            />

            <Input
              type="search"
              placeholder="Search communities, takes, or citizens..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const target = e.target;
                  if (target.value.trim()) {
                    navigate(
                      `/discover?q=${encodeURIComponent(target.value.trim())}`,
                    );
                  }
                }
              }}
              className="pl-12 h-12 bg-secondary/50 border-none focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-2xl text-sm font-bold placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications Dropdown Overlay */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div
                  className="relative h-10 w-10 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center cursor-pointer"
                  aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
                >
                  <BellIcon className="w-5 h-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-2 right-2 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-card"
                      aria-hidden="true"
                    >
                      {unreadCount}
                    </span>
                  )}
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-card border border-border shadow-xl rounded-2xl p-4 z-50 text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-border/40">
                  <h3 className="text-sm font-black text-foreground uppercase tracking-wider font-serif">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await markAllReadMutation.mutateAsync();
                          toast.success("All notifications marked as read!");
                        } catch (err) {
                          toast.error(err.message || "Failed to mark all as read");
                        }
                      }}
                      className="text-[10px] font-black text-primary hover:underline uppercase tracking-wider cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[380px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] space-y-2 pr-1">
                  {isLoadingNotifications ? (
                    <div className="py-8 text-center text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
                      Retrieving updates...
                    </div>
                  ) : notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={async () => {
                          try {
                            if (!n.read) {
                              await markReadMutation.mutateAsync(n.id);
                            }
                            if (n.roomId) {
                              navigate(`/room/${n.roomId}`);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={cn(
                          "flex gap-3 p-3 rounded-xl cursor-pointer hover:bg-muted/50 transition-all border border-transparent",
                          !n.read && "bg-primary/[0.08] border-primary/20 hover:bg-primary/[0.12]"
                        )}
                      >
                        <Avatar
                          src={n.trigger?.avatar}
                          name={n.title || "System"}
                          size="sm"
                          className="w-8 h-8 shrink-0"
                          userId={n.trigger?.id}
                        />
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className={cn("text-xs leading-snug text-foreground", !n.read ? "font-bold" : "font-medium")}>
                            {n.body || n.title}
                          </p>
                          <p className="text-[9px] text-muted-foreground font-mono uppercase">
                            {(() => {
                              if (!n.createdAt) return "";
                              const d = new Date(n.createdAt);
                              return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " - " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                            })()}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 self-center" />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-muted-foreground italic font-medium">
                      No notifications yet.
                    </div>
                  )}
                </div>
                <div className="pt-2 border-t border-border/40">
                  <Button
                    onClick={() => navigate("/notifications")}
                    className="w-full rounded-xl font-bold uppercase text-[10px] tracking-widest h-9 bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border/40"
                  >
                    View All Notifications
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <SunIcon className="w-[18px] h-[18px] text-muted-foreground" />
              ) : (
                <MoonIcon className="w-[18px] h-[18px] text-muted-foreground" />
              )}
            </Button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2.5 p-1.5 h-11 pr-3 rounded-xl hover:bg-secondary transition-all cursor-pointer"
                >
                  <Avatar
                    src={user.avatar || undefined}
                    name={user.username}
                    size="sm"
                  />

                  <div className="hidden lg:flex flex-col items-start leading-none gap-1">
                    <span className="text-sm font-bold text-foreground">
                      {(user.name || user.username).split(" ")[0]}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      {user.role}
                    </span>
                  </div>
                  <ChevronDownIcon
                    className="w-3.5 h-3.5 hidden lg:block text-muted-foreground/50 transition-transform duration-200"
                    aria-hidden="true"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
                <DropdownMenuLabel className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatar || undefined}
                      name={user.username}
                      size="md"
                      userId={user.id}
                    />
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
                    {user.verified && (
                      <Badge variant="verified" size="sm" className="h-5" />
                    )}
                    {user.role === "SUPER_ADMIN" && (
                      <Badge variant="superadmin" size="sm" className="h-5" />
                    )}
                    {user.role === "PLATFORM_ADMIN" && (
                      <Badge variant="admin" size="sm" className="h-5" />
                    )}
                    {user.role === "PLATFORM_MOD" && (
                      <Badge variant="moderator" size="sm" className="h-5" />
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <UserCircleIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Your Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <BellIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                {(["SUPER_ADMIN", "PLATFORM_ADMIN", "PLATFORM_MOD"].includes(user.role) || hasModeratedCommunities) && (
                  <DropdownMenuItem
                    onClick={() => navigate("/moderator")}
                    className="text-purple-600 dark:text-purple-400 font-bold"
                  >
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span className="font-medium text-sm">Moderator Panel</span>
                  </DropdownMenuItem>
                )}
                {(["SUPER_ADMIN", "PLATFORM_ADMIN"].includes(user.role) || hasAdminCommunities) && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="text-blue-600 dark:text-blue-400 font-bold"
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                    <span className="font-medium text-sm">Admin Settings</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/home")}>
                  <HomeIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Home</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                  }}
                  className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  <span className="font-medium text-sm">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden rounded-xl h-10 w-10 cursor-pointer"
            >
              <Bars3Icon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Sliding Sidebar Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Card */}
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-card py-4 shadow-xl animate-in slide-in-from-right duration-200">
            <div className="px-6 pb-4 border-b border-border flex items-center justify-between">
              <span className="font-bold text-xl">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="h-10 w-10 rounded-xl cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </Button>
            </div>
            <div className="px-6 py-4 space-y-6">
              <div className="relative">
                <MagnifyingGlassIcon
                  className="w-[18px] h-[18px] absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Search..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const target = e.target;
                      if (target.value.trim()) {
                        setMobileMenuOpen(false);
                        navigate(
                          `/discover?q=${encodeURIComponent(target.value.trim())}`,
                        );
                      }
                    }
                  }}
                  className="pl-11 h-12 bg-secondary/50 border-none rounded-2xl"
                />
              </div>
              <nav className="flex flex-col gap-2">
                {navLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-base font-bold transition-all",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-secondary",
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
                <Avatar
                  src={user.avatar || undefined}
                  name={user.username}
                  size="lg"
                  userId={user.id}
                />
                <div>
                  <p className="font-bold text-lg text-foreground truncate max-w-[150px]">
                    {user.name || user.username}
                  </p>
                  <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                    @{user.username}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                className="w-full h-12 rounded-2xl font-bold gap-3 cursor-pointer"
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
              >
                <ArrowRightOnRectangleIcon className="w-[18px] h-[18px]" /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
