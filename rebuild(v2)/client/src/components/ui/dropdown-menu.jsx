import * as React from "react";
import { cn } from "@/utils/cn";

const DropdownContext = React.createContext({});

export function DropdownMenu({ children, ...props }) {
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div
        ref={dropdownRef}
        className="relative inline-block text-left"
        {...props}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ children, ...props }) {
  const { open, setOpen } = React.useContext(DropdownContext);
  return React.cloneElement(children, {
    onClick: (e) => {
      if (children.props.onClick) children.props.onClick(e);
      setOpen?.(!open);
    },
    ...props,
  });
}

export function DropdownMenuContent({ children, className, ...props }) {
  const { open, setOpen } = React.useContext(DropdownContext);
  if (!open) return null;

  return (
    <div
      onClick={() => setOpen?.(false)}
      className={cn(
        "absolute right-0 mt-2 min-w-[12rem] bg-popover text-popover-foreground rounded-xl border border-border p-1 shadow-md z-50 animate-in fade-in slide-in-from-top-2 duration-150",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuItem({ className, children, onClick, ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground select-none transition-colors cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuLabel({ className, children, ...props }) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className, ...props }) {
  return (
    <div className={cn("my-1 border-t border-border", className)} {...props} />
  );
}
export function DropdownMenuGroup({ children, ...props }) {
  return <div {...props}>{children}</div>;
}
