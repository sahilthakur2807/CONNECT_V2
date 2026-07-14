import { useEffect } from "react";
import {
  NavLink,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  HomeIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  UserCircleIcon,
  HashtagIcon,
} from "@heroicons/react/24/outline";
import { Navbar } from "./Navbar";
import { useAppSelector, useAppDispatch } from "@/store";
import { useNotifications } from "@/hooks/useNotifications";
import { setUnreadNotificationsCount } from "@/store/slices/uiSlice";
import { cn } from "@/utils/cn";
import { useRooms } from "@/hooks/useRooms";
import { useGlobalSocketEvents } from "@/hooks/useGlobalSocketEvents";

const CATEGORIES = [
  "All Topics",
  "Politics",
  "Technology",
  "Economy",
  "Environment",
  "World Affairs",
  "Science",
  "Health",
  "Culture",
  "Sports",
];

const sideNavLinks = [
  { to: "/home", icon: <HomeIcon className="w-[18px] h-[18px]" />, label: "Home" },
  { to: "/discover", icon: <GlobeAltIcon className="w-[18px] h-[18px]" />, label: "Discover" },
  {
    to: "/discussions",
    icon: <ChatBubbleLeftRightIcon className="w-[18px] h-[18px]" />,
    label: "Discussions",
  },
  { to: "/notifications", icon: <BellIcon className="w-[18px] h-[18px]" />, label: "Notifications" },
  { to: "/profile", icon: <UserCircleIcon className="w-[18px] h-[18px]" />, label: "Profile" },
];

function LeftSidebar() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const activeCategory = searchParams.get("category");

  const { useCategoriesQuery } = useRooms();
  const { data: serverCategories } = useCategoriesQuery();
  const categoriesList = serverCategories ? ["All Topics", ...serverCategories] : CATEGORIES;

  const unreadCount = useAppSelector(
    (state) => state.ui.unreadNotificationsCount,
  );
  const currentUser = useAppSelector((state) => state.auth.user);
  const profilePath = currentUser ? `/profile/${currentUser.id}` : "/profile";

  return (
    <aside
      className="hidden lg:flex flex-col w-56 shrink-0 border-r border-border/50 pr-6 h-full overflow-y-auto py-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Navigation sidebar"
    >
      <div className="flex flex-col gap-6">
        <nav aria-label="Main">
          <ul className="space-y-0.5">
            {sideNavLinks.map((link) => {
              const toPath = link.to === "/profile" ? profilePath : link.to;
              return (
                <li key={link.to}>
                  <NavLink
                    to={toPath}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary font-normal"
                      }`
                    }
                    style={{ fontFamily: "'Hedvig Letters Serif', serif" }}
                  >
                    {link.icon}
                    {link.label}
                    {link.to === "/notifications" && unreadCount > 0 && (
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
            {categoriesList.map((cat) => {
              const isActiveCategory =
                location.pathname === "/discover" &&
                ((!activeCategory && cat === "All Topics") ||
                  (activeCategory && activeCategory.toLowerCase() === cat.toLowerCase()));
              return (
                <li key={cat}>
                  <Link
                    to={`/discover?category=${encodeURIComponent(cat)}`}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer ${
                      isActiveCategory
                        ? "bg-primary/10 text-primary font-extrabold"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <HashtagIcon
                      className={cn("w-3.5 h-3.5 shrink-0", isActiveCategory ? "text-primary" : "text-muted-foreground/50")}
                    />
                    {cat}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <div className="flex items-center gap-2 px-3 mb-2">
            <span
              className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              Recommended
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground/80 italic px-3 font-semibold">
            This option will be available soon
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppLayout() {
  const location = useLocation();

  const isRoomPage = location.pathname.startsWith("/room/");
  const showSidebar = !isRoomPage;

  const dispatch = useAppDispatch();
  
  // Initialize global socket subscriptions
  useGlobalSocketEvents();

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

      <div className={cn("flex-1 w-full overflow-hidden", 
        location.pathname === "/world-chat" ? "pl-4 sm:pl-5 pr-0" : (showSidebar ? "px-4 sm:px-5" : "px-0"),
        )}
        >
        <div className="flex h-full">
          {showSidebar && <LeftSidebar />}

          <main
            className={cn(
              "flex-1 h-full min-w-0 animate-in fade-in duration-300 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
              (isRoomPage || location.pathname === "/world-chat")
                ? "overflow-hidden flex flex-col py-0 px-0 pl-0"
                : "overflow-y-auto py-5 pl-6",
            )}
            id="main-content"
            tabIndex={-1}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
