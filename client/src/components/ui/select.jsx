import * as React from "react";
import { ChevronDownIcon, CheckIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/cn";

const SelectContext = React.createContext({});

export function Select({ value, onValueChange, children, className, ...props }) {
  const [open, setOpen] = React.useState(false);
  const selectRef = React.useRef(null);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div
        ref={selectRef}
        className={cn("relative w-full", className)}
        {...props}
      >
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ placeholder, className, ...props }) {
  const { value, open, setOpen } = React.useContext(SelectContext);

  return (
    <button
      type="button"
      onClick={() => setOpen?.(!open)}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer text-left",
        className
      )}
      {...props}
    >
      <span className="truncate">{value || placeholder}</span>
      <ChevronDownIcon
        className={cn(
          "h-4 w-4 opacity-50 transition-transform duration-200 shrink-0 ml-2",
          open && "rotate-180"
        )}
      />
    </button>
  );
}

export function SelectContent({ children, className, ...props }) {
  const { open } = React.useContext(SelectContext);

  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none animate-in fade-in slide-in-from-top-2 duration-150 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children, className, ...props }) {
  const { value: selectedValue, onValueChange, setOpen } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      onClick={() => {
        onValueChange?.(value);
        setOpen?.(false);
      }}
      className={cn(
        "relative flex w-full select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 cursor-pointer transition-colors text-left",
        isSelected && "font-semibold text-foreground",
        className
      )}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
          <CheckIcon className="h-4 w-4 text-primary" />
        </span>
      )}
      <span className="truncate">{children}</span>
    </button>
  );
}
