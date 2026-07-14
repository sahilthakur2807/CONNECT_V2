import { UsersIcon, ChatBubbleLeftRightIcon, BoltIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { Badge } from "./Badge";
import { cn } from "@/utils/cn";
import { useAppSelector } from "@/store";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function RoomCard({
  room,
  onJoin,
  onLeave,
  onClick,
  compact = false,
  className,
  index,
  activeTab,
}) {
  const currentUser = useAppSelector((state) => state.auth.user);
  const memberCount = room.memberCount ?? room._count?.members ?? 0;
  const messageCount = room.messageCount ?? room._count?.messages ?? 0;
  const activeNow = room.activeNow ?? 0;
  const isJoined = !!room.isJoined;
  const isPending = !!room.isPending;

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(room.id)}
        className={cn(
          "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
          className,
        )}
        aria-label={`Open room: ${room.title}`}
      >
        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {room.title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
            {activeNow > 0 ? (
              <>
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                <span className="text-green-600 dark:text-green-400 font-semibold">
                  {activeNow} active now
                </span>
              </>
            ) : (
              "0 in room now"
            )}
          </p>
        </div>
      </button>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 flex flex-col h-full cursor-pointer gap-0",
        className,
      )}
      onClick={() => onClick?.(room.id)}
    >
      <div className="h-32 overflow-hidden bg-muted relative">
        {(() => {
          const isGradient = room.imageUrl && room.imageUrl.startsWith("gradient:");
          if (isGradient) {
            const classes = room.imageUrl.replace("gradient:", "") + " bg-gradient-to-r w-full h-full transition-transform duration-500 hover:scale-105";
            return <div className={classes} />;
          }
          if (!room.imageUrl) {
            return (
              <img
                src="/room_banner.png"
                alt=""
                className="w-full h-full object-fill transition-transform duration-500 hover:scale-105"
                aria-hidden="true"
              />
            );
          }
          return (
            <img
              src={room.imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
              aria-hidden="true"
            />
          );
        })()}

        <div className="absolute top-3 left-3 flex gap-2">
          <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-md uppercase tracking-wider">
            {room.category}
          </span>
        </div>
      </div>

      <CardHeader className="p-4 pb-1">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {(() => {
            const N = 3;
            if (index !== undefined && index < N && activeTab) {
              if (activeTab === "trending") return <Badge variant="trending" size="sm" />;
              if (activeTab === "hot") return <Badge variant="hot" size="sm" />;
              if (activeTab === "newest" || activeTab === "new") return <Badge variant="new" size="sm" />;
            }
            return null;
          })()}
          {room.isPrivate && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20 px-2 py-0.5 rounded border border-amber-200/50 flex items-center gap-1">
              <LockClosedIcon className="w-2.5 h-2.5" /> Private
            </span>
          )}
          {room.archived && (
            <span className="text-[10px] font-bold text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-850 px-2 py-0.5 rounded border border-gray-200/50">
              Archived
            </span>
          )}
        </div>
        <CardTitle className="text-base font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {room.title}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-sm">
          {room.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-1 flex-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
            {memberCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-muted-foreground/70" />
            {messageCount.toLocaleString()}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 py-4 flex items-center justify-between border-t border-border/50 mt-auto">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-green-600 dark:text-green-400">
          {activeNow > 0 ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              {activeNow.toLocaleString() || 1} {activeNow === 1 ? "user" : "users"} active.
            </>
          ) : (
            <>
              <BoltIcon className="w-3.5 h-3.5 opacity-40" />
              <span className="text-muted-foreground">0 in room now</span>
            </>
          )}
        </div>

        {isJoined ? (
          room.createdById === currentUser?.id ? (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="h-7.5 px-3 text-xs font-semibold border-green-200 text-green-600 bg-green-500/5 dark:border-green-900/30 dark:text-green-400 opacity-90 cursor-default"
            >
              Owner
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onLeave?.(room.id);
              }}
              className="h-7.5 px-3 text-xs font-semibold cursor-pointer group/btn border-green-200 text-green-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 dark:border-green-900/30 dark:text-green-400 dark:hover:border-red-950/20 transition-all"
            >
              <span className="group-hover/btn:hidden">Joined</span>
              <span className="hidden group-hover/btn:inline">Leave</span>
            </Button>
          )
        ) : isPending ? (
          <Button
            size="sm"
            variant="ghost"
            disabled
            className="h-7.5 px-3 text-xs font-semibold border border-amber-200/50 bg-amber-50/55 text-amber-600 cursor-not-allowed"
          >
            Requested
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onJoin?.(room.id);
            }}
            className="h-7.5 px-3 text-xs font-semibold cursor-pointer"
          >
            Join
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
