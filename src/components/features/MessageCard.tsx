import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ThumbsUp, Lightbulb, CornerUpLeft, Flag, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Avatar } from './Avatar';
import { Badge } from './Badge';
import type { Message } from '@/types';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRoomStore } from '@/store/useRoomStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MessageCardProps {
  message: Message;
  onReply?: (messageId: string, userName: string) => void;
  currentUserId?: string;
  isReply?: boolean;
  className?: string;
}

export function MessageCard({ message, onReply, currentUserId, isReply = false, className }: MessageCardProps) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const user = (message as any).user;
  if (!user) return null;

  const isOwn = currentUserId === message.userId;

  // Derive counts and active states from props directly for real-time responsiveness
  const likesCount = message.reactions ? message.reactions.filter((r) => r.emoji === '👍').length : 0;
  const likesActive = message.reactions ? message.reactions.some((r) => r.emoji === '👍' && r.userId === currentUserId) : false;

  const insightsCount = message.reactions ? message.reactions.filter((r) => r.emoji === '💡').length : 0;
  const insightsActive = message.reactions ? message.reactions.some((r) => r.emoji === '💡' && r.userId === currentUserId) : false;

  const handleLikeClick = async () => {
    try {
      await useRoomStore.getState().toggleReaction(message.id, '👍');
    } catch (e) {
      console.error('Failed to toggle like reaction:', e);
    }
  };

  const handleInsightClick = async () => {
    try {
      await useRoomStore.getState().toggleReaction(message.id, '💡');
    } catch (e) {
      console.error('Failed to toggle insight reaction:', e);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      await useRoomStore.getState().editMessage(message.id, editContent.trim());
      setIsEditing(false);
    } catch (e) {
      console.error('Failed to edit message:', e);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this take?")) {
      try {
        await useRoomStore.getState().removeMessage(message.id);
      } catch (e) {
        console.error('Failed to delete message:', e);
      }
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'just now';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'just now';
    }
  };

  return (
    <article
      className={cn(
        !isReply && 'bg-card border border-border/50 rounded-[20px] p-4 hover:border-primary/20 transition-all duration-300 shadow-sm',
        isReply && 'py-2',
        className
      )}
      aria-label={`Message from ${user.name}`}
    >
      <div className="flex gap-3">
        <div className="cursor-pointer" onClick={() => navigate(`/profile/${user.id}`)}>
          <Avatar src={user.avatar} name={user.name} size={isReply ? "xs" : "sm"} status={user.status} showStatus={!isReply} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span 
              className="font-bold text-sm text-foreground tracking-tight cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${user.id}`)}
            >
              {user.name || user.username}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground/60">@{user.username}</span>
            <div className="flex gap-1">
              {user.verified && <Badge variant="verified" size="sm" showIcon={false} className="h-4 px-1.5" />}
              {user.role === 'admin' && <Badge variant="admin" size="sm" showIcon={false} className="h-4 px-1.5" />}
              {user.role === 'moderator' && <Badge variant="moderator" size="sm" showIcon={false} className="h-4 px-1.5" />}
            </div>
            <span className="text-muted-foreground/30">·</span>
            <time className="text-[11px] font-medium text-muted-foreground/60">
              {formatTime(message.createdAt)}
            </time>
            {message.edited && <span className="text-[10px] text-muted-foreground/40 font-bold italic">· EDITED</span>}
          </div>

          {/* Content / Edit Box */}
          {isEditing ? (
            <div className="space-y-2 mb-4">
              <Textarea 
                value={editContent} 
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-secondary/30"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} className="rounded-xl h-8 text-xs font-bold">Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsEditing(false); setEditContent(message.content); }} className="rounded-xl h-8 text-xs font-bold">Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-foreground/90 leading-snug mb-3 whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Reaction bar */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLikeClick}
              className={cn(
                "h-8 px-2.5 gap-2 rounded-xl text-xs font-bold transition-all",
                likesActive ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' : 'text-muted-foreground/70 hover:bg-secondary'
              )}
            >
              <ThumbsUp size={14} className={likesActive ? "fill-current" : ""} />
              <span>{likesCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleInsightClick}
              className={cn(
                "h-8 px-2.5 gap-2 rounded-xl text-xs font-bold transition-all",
                insightsActive ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20' : 'text-muted-foreground/70 hover:bg-secondary'
              )}
            >
              <Lightbulb size={14} className={insightsActive ? "fill-current" : ""} />
              <span>{insightsCount}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply?.(message.id, user.name || user.username)}
              className="h-8 px-2.5 gap-2 rounded-xl text-xs font-bold text-muted-foreground/70 hover:bg-secondary transition-all"
            >
              <CornerUpLeft size={14} />
              Reply
            </Button>

            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-foreground">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 rounded-xl p-1 shadow-xl border-border/50">
                {isOwn && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => setIsEditing(true)}
                      className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-sm"
                    >
                      <Pencil size={14} /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleDelete}
                      className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-sm text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                    >
                      <Trash2 size={14} /> Delete
                    </DropdownMenuItem>
                  </>
                )}
                {!isOwn && (
                  <DropdownMenuItem className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-sm text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20">
                    <Flag size={14} /> Report
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Nested replies */}
          {message.replies && message.replies.length > 0 && (
            <div className="mt-4 space-y-1 border-l-2 border-primary/10 pl-5 ml-1">
              {message.replies.map((reply) => (
                <MessageCard key={reply.id} message={reply} onReply={onReply} currentUserId={currentUserId} isReply />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
