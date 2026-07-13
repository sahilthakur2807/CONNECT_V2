import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

export function Spinner({ className, size = 24, ...props }) {
  return (
    <ArrowPathIcon
      style={{ width: size, height: size }}
      className={cn("animate-spin text-primary", className)}
      {...props}
    />
  );
}
