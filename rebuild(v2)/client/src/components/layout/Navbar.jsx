import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Menu,
  LogOut,
  User as UserIcon,
  Settings,
  Shield,
  Home,
  Sun,
  Moon,
  X,
} from "lucide-react";
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

export function Navbar() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { user, accessToken, isLoading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const unreadCount = useAppSelector(
    (state) => state.ui.unreadNotificationsCount,
  );

  const navLinks = [
    { to: "/home", label: "Home" },
    { to: "/discover", label: "Discover" },
    { to: "/discussions", label: "Discussions" },
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
            <Search
              size={18}
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 pointer-events-none z-10",
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
            {/* Notifications */}
            <Link
              to="/notifications"
              className="relative h-10 w-10 rounded-xl hover:bg-secondary transition-colors flex items-center justify-center"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
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

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl hover:bg-secondary transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="text-muted-foreground" />
              ) : (
                <Moon className="text-muted-foreground" />
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
              <DropdownMenuContent className="w-64 p-2 rounded-2xl shadow-2xl border-border/50">
                <DropdownMenuLabel className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={user.avatar || undefined}
                      name={user.username}
                      size="md"
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
                    {user.role === "superadmin" && (
                      <Badge variant="superadmin" size="sm" className="h-5" />
                    )}
                    {user.role === "admin" && (
                      <Badge variant="admin" size="sm" className="h-5" />
                    )}
                    {user.role === "moderator" && (
                      <Badge variant="moderator" size="sm" className="h-5" />
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => navigate(`/profile/${user.id}`)}
                >
                  <UserIcon size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Your Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <Bell size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                {(user.role === "moderator" ||
                  user.role === "admin" ||
                  user.role === "superadmin") && (
                  <DropdownMenuItem
                    onClick={() => navigate("/moderator")}
                    className="text-purple-600 dark:text-purple-400"
                  >
                    <Shield size={16} />
                    <span className="font-medium text-sm">Moderator Panel</span>
                  </DropdownMenuItem>
                )}
                {(user.role === "admin" || user.role === "superadmin") && (
                  <DropdownMenuItem
                    onClick={() => navigate("/admin")}
                    className="text-blue-600 dark:text-blue-400"
                  >
                    <Settings size={16} />
                    <span className="font-medium text-sm">Admin Settings</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/home")}>
                  <Home size={16} className="text-muted-foreground" />
                  <span className="font-medium text-sm">Home</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    logout();
                  }}
                  className="text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950/30"
                >
                  <LogOut size={16} />
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
              <Menu size={20} />
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
                <X size={20} />
              </Button>
            </div>
            <div className="px-6 py-4 space-y-6">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
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
                <LogOut size={18} /> Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
