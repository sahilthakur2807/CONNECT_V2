import { cn } from "@/utils/cn";

export function DashboardHeader({
  title,
  description,
  icon,
  actions,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8",
        className,
      )}
    >
      <div className="space-y-1">
        <h1
          className="text-2xl text-foreground tracking-tight flex items-center gap-2.5"
          style={{
            fontFamily: "'Hedvig Letters Serif', serif",
            fontWeight: 400,
          }}
        >
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </h1>
        {description && (
          <p
            className="text-[14px] text-muted-foreground max-w-lg leading-relaxed"
            style={{
              fontFamily: "'Hedvig Letters Serif', serif",
              fontWeight: 400,
            }}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-3 shrink-0">{actions}</div>
      )}
    </div>
  );
}
