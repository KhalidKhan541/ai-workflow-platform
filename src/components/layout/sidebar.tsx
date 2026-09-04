import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TooltipWrapper } from "@/components/ui/tooltip";

interface SidebarProps {
  children: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
  width?: number;
  collapsedWidth?: number;
}

function Sidebar({
  children,
  collapsed = false,
  onCollapsedChange,
  className,
  width = 260,
  collapsedWidth = 64,
}: SidebarProps) {
  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all duration-300",
        className
      )}
      style={{ width: collapsed ? collapsedWidth : width }}
    >
      {children}
      <button
        onClick={() => onCollapsedChange?.(!collapsed)}
        className="absolute -right-3 top-7 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md hover:text-foreground"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>
    </aside>
  );
}

interface SidebarHeaderProps {
  children: React.ReactNode;
  className?: string;
}

function SidebarHeader({ children, className }: SidebarHeaderProps) {
  return <div className={cn("flex h-14 items-center border-b px-4", className)}>{children}</div>;
}

interface SidebarContentProps {
  children: React.ReactNode;
  className?: string;
}

function SidebarContent({ children, className }: SidebarContentProps) {
  return (
    <ScrollArea className="flex-1 overflow-auto">
      <div className={cn("space-y-1 p-2", className)}>{children}</div>
    </ScrollArea>
  );
}

interface SidebarFooterProps {
  children: React.ReactNode;
  className?: string;
}

function SidebarFooter({ children, className }: SidebarFooterProps) {
  return (
    <div className={cn("flex items-center border-t p-2", className)}>{children}</div>
  );
}

interface SidebarSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

function SidebarSection({ title, children, className }: SidebarSectionProps) {
  return (
    <div className={cn("space-y-1", className)}>
      {title && (
        <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: string | number;
  onClick?: () => void;
  collapsed?: boolean;
  className?: string;
}

function SidebarItem({
  icon,
  label,
  href,
  active,
  disabled,
  badge,
  onClick,
  collapsed,
  className,
}: SidebarItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none opacity-50",
        className
      )}
      onClick={disabled ? undefined : onClick}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {badge}
            </span>
          )}
        </>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <TooltipWrapper content={label} side="right">
        {href ? (
          <a href={href}>{content}</a>
        ) : (
          content
        )}
      </TooltipWrapper>
    );
  }

  return href ? (
    <a href={href}>{content}</a>
  ) : (
    content
  );
}

interface SidebarSubItemProps {
  icon?: React.ReactNode;
  label: string;
  href?: string;
  active?: boolean;
  onClick?: () => void;
  collapsed?: boolean;
}

function SidebarSubItem({ icon, label, href, active, onClick, collapsed }: SidebarSubItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 pl-8 text-sm transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={onClick}
    >
      {icon && <span className="flex-shrink-0 text-xs">{icon}</span>}
      <span className="truncate">{label}</span>
    </div>
  );

  if (collapsed) return null;

  return href ? <a href={href}>{content}</a> : content;
}

interface SidebarLogoProps {
  icon: React.ReactNode;
  name: string;
  collapsed?: boolean;
}

function SidebarLogo({ icon, name, collapsed }: SidebarLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex-shrink-0">{icon}</span>
      {!collapsed && <span className="text-lg font-bold truncate">{name}</span>}
    </div>
  );
}

export {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarSection,
  SidebarItem,
  SidebarSubItem,
  SidebarLogo,
};
