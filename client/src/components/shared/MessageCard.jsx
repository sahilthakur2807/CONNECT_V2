import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSocket } from "@/services/socketService";
import {
  FlagIcon,
  EllipsisHorizontalIcon,
  PencilSquareIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Avatar } from "./Avatar";
import { useEditMessageMutation, useDeleteMessageMutation } from "@/hooks/useMessages";
import { useModeration } from "@/hooks/useModeration";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

// Helper to check for actual visible text content (ignores zero-width/invisible Unicode spaces and Braille blank spaces)
const hasVisibleContent = (text) => {
  if (!text) return false;
  // Remove normal whitespaces, zero-width chars, formatting symbols, and Braille blanks
  const cleaned = text
    .replace(/[\s\u200B-\u200D\uFEFF\u2000-\u200F\u2028\u2029\u202F\u205F\u3000\u2800]/g, "")
    .replace(/\p{Z}/gu, "")
    .replace(/\p{C}/gu, "");
  return cleaned.length > 0;
};

export function MessageCard({
  message,
  onReply,
  currentUserId,
  isReply = false,
  className,
  depth = 0,
  parentname,
  isConsecutive = false,
  isLastInGroup = true,
}) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Simulated interactive reactions - default 0 and hidden
  const [reactionCounts, setReactionCounts] = useState(
    message.reactionCounts || {
      like: 0,
      fire: 0,
      heart: 0,
    }
  );
  const [activeReactions, setActiveReactions] = useState({
    like: false,
    fire: false,
    heart: false,
  });
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);

  // Sync reactions when cache changes (e.g. from real-time sockets)
  useEffect(() => {
    if (message.reactionCounts) {
      setReactionCounts(message.reactionCounts);
    }
  }, [message.reactionCounts]);

  const editMessageMutation = useEditMessageMutation();
  const deleteMessageMutation = useDeleteMessageMutation(message.roomId);
  const { submitReportMutation } = useModeration();

  // Report Modal States
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Inappropriate Content");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSeverity, setReportSeverity] = useState("medium");

  const user = message.user;
  if (!user) return null;

  const isOwn = currentUserId === message.userId;

  const handleSaveEdit = async () => {
    if (!hasVisibleContent(editContent)) return;
    try {
      await editMessageMutation.mutateAsync({
        messageId: message.id,
        content: editContent.trim(),
      });
      setIsEditing(false);
      toast.success("Take updated!");
    } catch (e) {
      toast.error(e.message || "Failed to edit take");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this take?")) {
      try {
        await deleteMessageMutation.mutateAsync(message.id);
        toast.success("Take deleted");
      } catch (e) {
        toast.error(e.message || "Failed to delete take");
      }
    }
  };

  const handleReportSubmit = async () => {
    if (!reportDesc.trim()) {
      toast.error("Please describe the reason for this report.");
      return;
    }
    try {
      await submitReportMutation.mutateAsync({
        reason: reportReason,
        description: reportDesc,
        severity: reportSeverity,
        messageId: message.id,
        reportedUserId: message.userId,
        roomId: message.roomId,
      });
      setReportOpen(false);
      setReportDesc("");
      toast.success("Thank you. Content has been reported to moderators.");
    } catch (e) {
      toast.error(e.message || "Failed to submit report");
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return "just now";
    try {
      const date = new Date(isoString);
      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return timeStr;
    } catch {
      return "just now";
    }
  };

  const toggleReaction = (type) => {
    const isActive = activeReactions[type];
    const newActive = !isActive;
    const newCount = isActive ? Math.max(0, reactionCounts[type] - 1) : reactionCounts[type] + 1;

    const newReactionCounts = {
      ...reactionCounts,
      [type]: newCount,
    };

    setActiveReactions((prev) => ({ ...prev, [type]: newActive }));
    setReactionCounts(newReactionCounts);

    // Emit socket event to update other clients globally in real-time
    const socket = getSocket();
    socket.emit("chat.message.reacted", {
      roomId: message.roomId,
      messageId: message.id,
      reactionCounts: newReactionCounts,
    });
  };

  const maxVisualIndent = 2;
  const shouldIndent = depth < maxVisualIndent;

  // Build list of unique avatars in replies for collapsed state
  const replyAvatars = message.replies
    ? Array.from(new Set(message.replies.map((r) => r.user?.avatar).filter(Boolean)))
    : [];

  return (
    <article
      className={cn(
        "group/card relative w-full flex gap-2.5 px-1.5 transition-all duration-150 hover:bg-neutral-50 dark:hover:bg-neutral-900/10 rounded-lg",
        isConsecutive ? "pt-0 pb-0.5" : "pt-1.5 pb-1.5",
        message.replies && message.replies.length > 0 && !isCollapsed && "pb-0",
        isReply && "pl-3 ml-0.5",
        className
      )}
      aria-label={`Message from ${user.username}`}
    >
      {/* Squircle Avatar Section */}
      {isConsecutive ? (
        <div className={cn("shrink-0 flex items-start justify-end text-[8px] font-medium text-muted-foreground/35 font-mono opacity-0 group-hover/card:opacity-100 transition-opacity select-none pt-0.5 pr-0.5", depth > 0 ? "w-6" : "w-8")}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
        </div>
      ) : (
        <div
          className="relative cursor-pointer shrink-0 transition-transform active:scale-95 self-start mt-0.5"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          <Avatar
            src={user.avatar}
            name={user.username}
            size={depth > 0 ? "xs" : "sm"}
            className="!rounded-lg"
          />
        </div>
      )}

      {/* Content Section */}
      <div className="flex-1 min-w-0">
        {/* Header Row */}
        {!isConsecutive && (
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className="font-bold text-sm text-foreground tracking-tight cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${user.id}`)}
            >
              {user.name || user.username}
            </span>

            {parentname && depth >= 2 && (
              <span className="text-[11px] text-muted-foreground/50 font-semibold font-sans">
                replying to <span className="text-primary hover:underline cursor-pointer">@{parentname}</span>
              </span>
            )}

            {user.role && user.role !== "MEMBER" && (
              <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest font-mono">
                {user.role}
              </span>
            )}

            {/* Timestamp */}
            <time className="text-[10px] font-medium text-muted-foreground/40 font-mono">
              {formatTime(message.createdAt)}
            </time>

            {message.edited && (
              <span className="text-[9px] text-muted-foreground/30 font-semibold uppercase">
                (edited)
              </span>
            )}
          </div>
        )}

        {/* Text Content / Editor */}
        {isEditing ? (
          <div className="space-y-2 mt-1.5 mb-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-secondary/30 min-h-[70px] rounded-xl text-sm"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                className="rounded-xl h-7 px-3 text-[10px] font-black uppercase tracking-wider cursor-pointer"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                className="rounded-xl h-7 px-3 text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-secondary"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-foreground/90 leading-normal whitespace-pre-wrap">
            {message.deleted ? (
              <span className="text-muted-foreground/30 italic font-medium text-xs">
                This take was deleted.
              </span>
            ) : (
              message.content
            )}
          </div>
        )}

        {/* Actions Row */}
        {!message.deleted && (isLastInGroup || Object.values(reactionCounts).some((c) => c > 0)) && (
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Active reaction pills (only displayed if count > 0) */}
            {Object.entries(reactionCounts).map(([type, count]) => {
              if (count === 0) return null;
              const emoji = type === "like" ? "👍" : type === "fire" ? "🔥" : "❤️";
              const isActive = activeReactions[type];
              return (
                <button
                  key={type}
                  onClick={() => toggleReaction(type)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-muted/40 text-muted-foreground border-border/40 hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <span>{emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}

            {/* + React & Reply option (only show for the last message in a consecutive group) */}
            {isLastInGroup && (
              <>
                {/* + React Button */}
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPanel(!showEmojiPanel)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground transition-all cursor-pointer border border-transparent"
                  >
                    + React
                  </button>

                  {showEmojiPanel && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowEmojiPanel(false)}
                      />
                      <div className="absolute bottom-full left-0 mb-1 z-50 flex items-center gap-1 p-1 bg-popover border border-border shadow-xl rounded-xl animate-in fade-in slide-in-from-bottom-1">
                        <button
                          onClick={() => {
                            toggleReaction("like");
                            setShowEmojiPanel(false);
                          }}
                          className="p-1.5 hover:bg-secondary rounded-lg text-sm cursor-pointer"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => {
                            toggleReaction("fire");
                            setShowEmojiPanel(false);
                          }}
                          className="p-1.5 hover:bg-secondary rounded-lg text-sm cursor-pointer"
                        >
                          🔥
                        </button>
                        <button
                          onClick={() => {
                            toggleReaction("heart");
                            setShowEmojiPanel(false);
                          }}
                          className="p-1.5 hover:bg-secondary rounded-lg text-sm cursor-pointer"
                        >
                          ❤️
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Reply Button */}
                {onReply && depth < 2 && (
                  <button
                    onClick={() => onReply(message.id, user.username)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground transition-all cursor-pointer"
                  >
                    Reply
                  </button>
                )}
              </>
            )}

            {/* Collapse/Expand Toggle (if has replies) */}
            {message.replies && message.replies.length > 0 && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground transition-all cursor-pointer ml-auto"
              >
                {isCollapsed ? (
                  <>
                    <ChevronRightIcon className="w-3 h-3" />
                    Show ({message.replies.length})
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className="w-3 h-3" />
                    Collapse
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Collapsed indicator preview */}
        {message.replies && message.replies.length > 0 && isCollapsed && (
          <button
            onClick={() => setIsCollapsed(false)}
            className="mt-2 flex items-center gap-2 px-2.5 py-1 bg-secondary/30 hover:bg-secondary/60 rounded-full border border-border/40 text-[10px] font-bold text-muted-foreground transition-all cursor-pointer w-fit"
          >
            <div className="flex -space-x-1 shrink-0">
              {replyAvatars.slice(0, 3).map((avatar, i) => (
                <img
                  key={i}
                  src={avatar}
                  className="w-3.5 h-3.5 rounded-full border border-card object-cover"
                  alt=""
                />
              ))}
            </div>
            <span>
              Expand thread ({message.replies.length} {message.replies.length === 1 ? "reply" : "replies"})
            </span>
          </button>
        )}

        {/* Nested Replies Recursion */}
        {message.replies && message.replies.length > 0 && !isCollapsed && (
          <div
            className={cn(
              "mt-1.5 space-y-1.5 relative transition-all duration-300",
              shouldIndent ? "pl-3 ml-0.5" : "pl-0 border-none"
            )}
          >
            {/* Clickable Hover Connector Line */}
            {shouldIndent && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30 dark:bg-primary/20 hover:bg-primary transition-all cursor-pointer group focus:outline-none"
                title="Collapse thread"
                style={{ transform: "translateX(-1px)" }}
              >
                <span className="absolute -left-1 -right-1 top-0 bottom-0 bg-transparent rounded-full" />
              </button>
            )}

            {message.replies.map((reply, idx) => {
              const prevReply = idx > 0 ? message.replies[idx - 1] : null;
              const isReplyConsecutive = prevReply && prevReply.userId === reply.userId;
              const isReplyLastInGroup = idx === message.replies.length - 1 || message.replies[idx + 1].userId !== reply.userId;
              return (
                <MessageCard
                  key={reply.id}
                  message={reply}
                  onReply={onReply}
                  currentUserId={currentUserId}
                  isReply={true}
                  depth={depth + 1}
                  parentname={user.name}
                  isConsecutive={isReplyConsecutive}
                  isLastInGroup={isReplyLastInGroup}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Settings Dropdown on Hover */}
      {!message.deleted && (
        <div className="opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 self-start ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground/50 hover:bg-secondary/60 hover:text-foreground transition-all cursor-pointer">
                <EllipsisHorizontalIcon className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40 rounded-xl p-1 shadow-xl border-border/50 bg-card">
              {isOwn && (
                <>
                  <DropdownMenuItem
                    onClick={() => setIsEditing(true)}
                    className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-xs text-foreground bg-transparent"
                  >
                    <PencilSquareIcon className="w-3 h-3" /> Edit Take
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-xs text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                  >
                    <TrashIcon className="w-3 h-3" /> Delete Take
                  </DropdownMenuItem>
                </>
              )}
              {!isOwn && (
                <DropdownMenuItem
                  onClick={() => setReportOpen(true)}
                  className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-xs text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                >
                  <FlagIcon className="w-3 h-3" /> Report Abuse
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Report Content</DialogTitle>
            <DialogDescription>
              Submit a formal report. Moderators will inspect this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div className="space-y-1.5">
              <label
                htmlFor="reason"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground"
              >
                Reason
              </label>
              <Select
                value={reportReason}
                onValueChange={setReportReason}
              >
                <SelectTrigger id="reason" className="rounded-xl h-10 border-border" />
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="Inappropriate Content">Inappropriate Content</SelectItem>
                  <SelectItem value="Harassment / Bullying">Harassment / Bullying</SelectItem>
                  <SelectItem value="Spam / Misinformation">Spam / Misinformation</SelectItem>
                  <SelectItem value="Hate Speech">Hate Speech</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="severity"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground"
              >
                Severity
              </label>
              <Select
                value={reportSeverity}
                onValueChange={setReportSeverity}
              >
                <SelectTrigger id="severity" className="rounded-xl h-10 border-border" />
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="low">Low - Minor infraction</SelectItem>
                  <SelectItem value="medium">Medium - Clear violation</SelectItem>
                  <SelectItem value="high">High - Extreme harassment/abuse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="description"
                className="text-xs font-black uppercase tracking-widest text-muted-foreground"
              >
                Details
              </label>
              <Textarea
                id="description"
                placeholder="Provide additional details..."
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                className="w-full min-h-[80px] rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setReportOpen(false)}
              className="cursor-pointer rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReportSubmit}
              className="cursor-pointer rounded-xl font-bold text-xs"
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export default MessageCard;
