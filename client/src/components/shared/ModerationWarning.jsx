/**
 * ModerationWarning
 *
 * Premium inline warning banner shown inside the message composer when the
 * real-time moderation check flags the content as unsafe.
 *
 * Props:
 *   moderationState  — from useModerationCheck()
 *   className        — optional extra classes
 */

import { ShieldExclamationIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";
import { CATEGORY_LABELS } from "@/hooks/useModerationCheck";

// Map categories to severity-based colours (Tailwind v4 compatible utility classes)
const SEVERITY_COLOURS = {
  threat:           { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-600",    badge: "bg-red-500/15 text-red-700"    },
  violent_language: { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-600",    badge: "bg-red-500/15 text-red-700"    },
  sexual_abuse:     { bg: "bg-rose-500/10",   border: "border-rose-500/30",   text: "text-rose-600",   badge: "bg-rose-500/15 text-rose-700"   },
  hate_speech:      { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600", badge: "bg-orange-500/15 text-orange-700" },
  harassment:       { bg: "bg-amber-500/10",  border: "border-amber-500/30",  text: "text-amber-600",  badge: "bg-amber-500/15 text-amber-700"  },
  insult:           { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600", badge: "bg-yellow-500/15 text-yellow-700" },
  profanity:        { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600", badge: "bg-yellow-500/15 text-yellow-700" },
};

const DEFAULT_COLOUR = {
  bg: "bg-red-500/10",
  border: "border-red-500/30",
  text: "text-red-600",
  badge: "bg-red-500/15 text-red-700",
};

function getWorstSeverity(categories) {
  const ORDER = ["threat", "violent_language", "sexual_abuse", "hate_speech", "harassment", "insult", "profanity"];
  for (const cat of ORDER) {
    if (categories.includes(cat)) return SEVERITY_COLOURS[cat] || DEFAULT_COLOUR;
  }
  return DEFAULT_COLOUR;
}

export function ModerationWarning({ moderationState, className }) {
  const { status, categories = [], confidence, categoryDetails = [] } = moderationState;

  if (status !== "unsafe") return null;

  const colours = getWorstSeverity(categories);
  const topDetails = [...categoryDetails]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 px-3.5 py-2.5 border-b transition-all duration-300 animate-in slide-in-from-top-1 fade-in",
        colours.bg,
        colours.border,
        className
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className={cn("shrink-0 mt-0.5", colours.text)}>
        {categories.includes("threat") || categories.includes("violent_language")
          ? <ShieldExclamationIcon className="w-3.5 h-3.5" />
          : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-[10px] font-black uppercase tracking-widest font-mono leading-tight", colours.text)}>
          Message flagged — unsafe content detected
        </p>

        {/* Category badges */}
        {topDetails.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {topDetails.map(({ category, score }) => (
              <span
                key={category}
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider font-mono",
                  colours.badge
                )}
              >
                {CATEGORY_LABELS[category] || category}
                {score != null && (
                  <span className="opacity-60">{Math.round(score * 100)}%</span>
                )}
              </span>
            ))}
          </div>
        )}

        <p className="text-[9px] text-muted-foreground/70 mt-1 leading-relaxed">
          Please revise your message. Sending is disabled until content is safe.
        </p>
      </div>
    </div>
  );
}

/**
 * ModerationCheckingIndicator — subtle spinner shown while model is running.
 */
export function ModerationCheckingIndicator({ moderationState }) {
  if (moderationState.status !== "checking") return null;
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-1.5 border-b border-border/30 bg-muted/30 animate-in fade-in duration-200">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary/60" />
      </span>
      <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 font-mono">
        Checking content safety…
      </span>
    </div>
  );
}
