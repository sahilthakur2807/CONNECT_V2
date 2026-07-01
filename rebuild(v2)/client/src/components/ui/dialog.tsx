import * as React from "react";
import { createPortal } from "react-dom";
import { XIcon } from "lucide-react";
import { cn } from "@/utils/cn";

const DialogContext = React.createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>({});

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  ...props
}: {
  children: React.ReactElement;
  [key: string]: any;
}) {
  const { onOpenChange } = React.useContext(DialogContext);
  return React.cloneElement(children as any, {
    onClick: (e: React.MouseEvent) => {
      if ((children.props as any).onClick) (children.props as any).onClick(e);
      if (onOpenChange) onOpenChange(true);
    },
    ...props,
  });
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export function DialogOverlay({ className, ...props }: React.ComponentProps<"div">) {
  const { onOpenChange } = React.useContext(DialogContext);
  return (
    <div
      onClick={() => onOpenChange?.(false)}
      className={cn("fixed inset-0 z-50 bg-black/50 transition-opacity", className)}
      {...props}
    />
  );
}

export function DialogClose({
  children,
  ...props
}: {
  children: React.ReactElement;
  [key: string]: any;
}) {
  const { onOpenChange } = React.useContext(DialogContext);
  return React.cloneElement(children as any, {
    onClick: (e: React.MouseEvent) => {
      if ((children.props as any).onClick) (children.props as any).onClick(e);
      if (onOpenChange) onOpenChange(false);
    },
    ...props,
  });
}

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  if (!open) return null;

  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        data-slot="dialog-content"
        className={cn(
          "bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg animate-in fade-in zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        <button
          onClick={() => onOpenChange?.(false)}
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-none text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <XIcon size={16} />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
