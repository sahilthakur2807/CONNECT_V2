import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { cn } from "@/utils/cn";

export function EmptyState({ icon, title, description, action, className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in duration-500",
        className,
      )}
      role="status"
    >
      <div className="w-20 h-20 bg-secondary/50 rounded-3xl flex items-center justify-center mb-6 text-muted-foreground shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-sm font-medium text-muted-foreground max-w-xs mb-8 leading-relaxed">
        {description}
      </p>
      {action}
    </div>
  );
}

export function LoadingState({ label = "Loading...", className }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20",
        className,
      )}
      role="status"
      aria-label={label}
    >
      <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
        {label}
      </p>
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 px-6 text-center",
        className,
      )}
      role="alert"
    >
      <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 rounded-3xl flex items-center justify-center mb-6 text-red-500 shadow-sm">
        <AlertCircle size={40} />
      </div>
      <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">
        System Error
      </h3>
      <p className="text-sm font-medium text-muted-foreground max-w-xs mb-8 leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button
          onClick={onRetry}
          className="h-11 px-8 rounded-xl font-bold shadow-lg shadow-primary/20"
        >
          Try Again
        </Button>
      )}
    </div>
  );
}
