import { Users, MessageSquare, Activity } from 'lucide-react';
import { Badge } from './Badge';
import type { Room } from '@/types';
import { cn } from '@/utils/cn';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface RoomCardProps {
  room: Room & {
    memberCount?: number;
    messageCount?: number;
    activeNow?: number;
    isJoined?: boolean;
  };
  onJoin?: (id: string) => void;
  onLeave?: (id: string) => void;
  onClick?: (id: string) => void;
  compact?: boolean;
  className?: string;
}

export function RoomCard({ room, onJoin, onLeave, onClick, compact = false, className }: RoomCardProps) {
  const memberCount = room.memberCount ?? room._count?.members ?? 0;
  const messageCount = room.messageCount ?? room._count?.messages ?? 0;
  const activeNow = room.activeNow ?? Math.ceil(memberCount * 0.4);

  if (compact) {
    return (
      <button
        onClick={() => onClick?.(room.id)}
        className={cn(
          "w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
        aria-label={`Open room: ${room.title}`}
      >
        <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {room.title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {activeNow.toLocaleString()} active now
          </p>
        </div>
      </button>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden hover:shadow-lg hover:border-primary/20 transition-all duration-300 flex flex-col h-full cursor-pointer",
        className
      )}
      onClick={() => onClick?.(room.id)}
    >
      {room.imageUrl && (
        <div className="h-44 overflow-hidden bg-muted relative">
          <img
            src={room.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            aria-hidden="true"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <span className="text-[10px] font-bold text-white bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-md uppercase tracking-wider">
              {room.category}
            </span>
          </div>
        </div>
      )}

      <CardHeader className="p-5 pb-2">
        <div className="flex items-center gap-2 mb-2">
          {room.trending && <Badge variant="trending" size="sm" />}
          {room.isNew && <Badge variant="new" size="sm" />}
        </div>
        <CardTitle className="text-lg font-bold leading-tight group-hover:text-primary transition-colors line-clamp-2">
          {room.title}
        </CardTitle>
        <CardDescription className="line-clamp-2 text-sm">
          {room.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pt-2 flex-1">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-muted-foreground/70" />
            {memberCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-muted-foreground/70" />
            {messageCount.toLocaleString()}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 flex items-center justify-between border-t border-border/50 mt-auto">
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
          <Activity size={14} />
          {activeNow.toLocaleString()} active
        </div>

        {room.isJoined ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onLeave?.(room.id);
            }}
            className="h-8 px-4 font-semibold cursor-pointer group/btn border-green-200 text-green-600 hover:border-red-200 hover:text-red-600 hover:bg-red-50 dark:border-green-900/30 dark:text-green-400 dark:hover:border-red-950/20 transition-all"
          >
            <span className="group-hover/btn:hidden">Joined</span>
            <span className="hidden group-hover/btn:inline">Leave</span>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onJoin?.(room.id);
            }}
            className="h-8 px-4 font-semibold cursor-pointer"
          >
            Join
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
