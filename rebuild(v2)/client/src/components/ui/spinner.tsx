import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export function Spinner({ className, size = 24, ...props }: { className?: string; size?: number; [key: string]: any }) {
  return (
    <Loader2
      size={size}
      className={cn("animate-spin text-primary", className)}
      {...props}
    />
  );
}
