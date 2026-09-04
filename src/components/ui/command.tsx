import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Command as CommandIcon, X, CornerDownLeft } from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  shortcut?: string;
  group?: string;
  disabled?: boolean;
  onSelect?: () => void;
}

interface CommandProps {
  items: CommandItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  onSelect?: (item: CommandItem) => void;
}

function Command({
  items,
  open = false,
  onOpenChange,
  placeholder = "Type a command or search...",
  emptyMessage = "No results found",
  className,
  onSelect,
}: CommandProps) {
  const [query, setQuery] = React.useState("");
  const [selectedItem, setSelectedItem] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange?.(!open);
      }
      if (e.key === "Escape" && open) {
        onOpenChange?.(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedItem(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filteredItems = React.useMemo(() => {
    if (!query) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

  const groupedItems = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredItems.forEach((item) => {
      const group = item.group || "Suggestions";
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    return groups;
  }, [filteredItems]);

  const handleSelect = (item: CommandItem) => {
    if (item.disabled) return;
    onSelect?.(item);
    item.onSelect?.();
    onOpenChange?.(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const enabledItems = filteredItems.filter((item) => !item.disabled);
    const currentIndex = enabledItems.findIndex((item) => item.id === selectedItem);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (currentIndex < enabledItems.length - 1) {
          setSelectedItem(enabledItems[currentIndex + 1].id);
        } else {
          setSelectedItem(enabledItems[0]?.id || null);
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedItem(enabledItems[currentIndex - 1].id);
        } else {
          setSelectedItem(enabledItems[enabledItems.length - 1]?.id || null);
        }
        break;
      case "Enter":
        e.preventDefault();
        if (selectedItem) {
          const item = filteredItems.find((i) => i.id === selectedItem);
          if (item) handleSelect(item);
        }
        break;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg">
        <div
          className={cn(
            "overflow-hidden rounded-lg border bg-popover shadow-2xl animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => onOpenChange?.(false)}
              className="ml-2 rounded-md border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
            >
              esc
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
            {Object.entries(groupedItems).length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              Object.entries(groupedItems).map(([group, items]) => (
                <div key={group}>
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {group}
                  </div>
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      disabled={item.disabled}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        selectedItem === item.id && "bg-accent text-accent-foreground",
                        item.disabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {item.icon && (
                        <span className="flex-shrink-0 text-muted-foreground">{item.icon}</span>
                      )}
                      <div className="flex-1 text-left">
                        <div>{item.label}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                          {item.shortcut}
                        </kbd>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> select
            </span>
            <span className="flex items-center gap-1">↑↓ navigate</span>
            <span className="flex items-center gap-1">esc close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CommandTrigger({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
        className
      )}
    >
      <CommandIcon className="h-4 w-4" />
      {children}
      <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}

export { Command, CommandTrigger, type CommandItem };
