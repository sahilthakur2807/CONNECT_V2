import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ThumbsUp,
  Lightbulb,
  CornerUpLeft,
  Flag,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Badge } from "./Badge";
import { useMessages } from "@/hooks/useMessages";
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

export function MessageCard({
  message,
  onReply,
  currentUserId,
  isReply = false,
  className,
}) {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const { editMessageMutation, deleteMessageMutation } = useMessages(
    message.roomId,
  );
  const { submitReportMutation } = useModeration();

  // Report Modal States
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("Inappropriate Content");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSeverity, setReportSeverity] = useState("medium");

  const user = message.user;
  if (!user) return null;

  const isOwn = currentUserId === message.userId;

  // React enforcements: Reactions are not supported by the backend v2 database, so we visual mock/disable them.
  const likesCount = 0;
  const insightsCount = 0;

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
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
      return (
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        " - " +
        date.toLocaleDateString([], { month: "short", day: "numeric" })
      );
    } catch {
      return "just now";
    }
  };

  return (
    <article
      className={cn(
        !isReply &&
          "bg-card border border-border/50 rounded-[20px] p-4 hover:border-primary/20 transition-all duration-300 shadow-sm",
        isReply && "py-2",
        className,
      )}
      aria-label={`Message from ${user.username}`}
    >
      <div className="flex gap-3">
        <div
          className="cursor-pointer"
          onClick={() => navigate(`/profile/${user.id}`)}
        >
          <Avatar
            src={user.avatar}
            name={user.username}
            size={isReply ? "xs" : "sm"}
          />
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
            <span className="text-[11px] font-medium text-muted-foreground/60">
              @{user.username}
            </span>
            <div className="flex gap-1">
              {user.verified && (
                <Badge
                  variant="verified"
                  size="sm"
                  showIcon={false}
                  className="h-4 px-1.5"
                />
              )}
              {user.role === "superadmin" && (
                <Badge
                  variant="superadmin"
                  size="sm"
                  showIcon={false}
                  className="h-4 px-1.5"
                />
              )}
              {user.role === "admin" && (
                <Badge
                  variant="admin"
                  size="sm"
                  showIcon={false}
                  className="h-4 px-1.5"
                />
              )}
              {user.role === "moderator" && (
                <Badge
                  variant="moderator"
                  size="sm"
                  showIcon={false}
                  className="h-4 px-1.5"
                />
              )}
            </div>
            <span className="text-muted-foreground/30">·</span>
            <time className="text-[11px] font-medium text-muted-foreground/60">
              {formatTime(message.createdAt)}
            </time>
            {message.edited && (
              <span className="text-[10px] text-muted-foreground/40 font-bold italic">
                · EDITED
              </span>
            )}
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
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="rounded-xl h-8 text-xs font-bold cursor-pointer"
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
                  className="rounded-xl h-8 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[15px] text-foreground/90 leading-snug mb-3 whitespace-pre-wrap">
              {message.deleted ? (
                <span className="text-muted-foreground/40 italic font-medium">
                  This take was deleted.
                </span>
              ) : (
                message.content
              )}
            </p>
          )}

          {/* Action bar */}
          {!message.deleted && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-8 px-2.5 gap-2 rounded-xl text-xs font-bold text-muted-foreground/40"
              >
                <ThumbsUp size={14} />
                <span>{likesCount}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                disabled
                className="h-8 px-2.5 gap-2 rounded-xl text-xs font-bold text-muted-foreground/40"
              >
                <Lightbulb size={14} />
                <span>{insightsCount}</span>
              </Button>

              {onReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReply(message.id, user.username)}
                  className="h-8 px-2.5 gap-2 rounded-xl text-xs font-bold text-muted-foreground/70 hover:bg-secondary transition-all cursor-pointer"
                >
                  <CornerUpLeft size={14} />
                  Reply
                </Button>
              )}

              <div className="flex-1" />

              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-xl text-muted-foreground/50 hover:text-foreground cursor-pointer"
                  >
                    <MoreHorizontal size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-40 rounded-xl p-1 shadow-xl border-border/50">
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
                    <DropdownMenuItem
                      onClick={() => setReportOpen(true)}
                      className="gap-2.5 rounded-lg py-2 cursor-pointer font-medium text-sm text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/20"
                    >
                      <Flag size={14} /> Report
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Nested replies */}
          {message.replies && message.replies.length > 0 && (
            <div className="mt-4 space-y-1 border-l-2 border-primary/10 pl-5 ml-1">
              {message.replies.map((reply) => (
                <MessageCard
                  key={reply.id}
                  message={reply}
                  onReply={onReply}
                  currentUserId={currentUserId}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
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
                <SelectTrigger id="reason" />
                <SelectContent>
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
                <SelectTrigger id="severity" />
                <SelectContent>
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
                className="w-full min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReportOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button onClick={handleReportSubmit} className="cursor-pointer">
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
