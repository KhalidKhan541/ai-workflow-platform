import * as React from "react";
import { cn } from "@/lib/utils";
import { Search, Bell, Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuActions,
} from "@/components/ui/dropdown";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";

interface HeaderProps {
  children?: React.ReactNode;
  className?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

function Header({ children, className, onMenuClick, showMenuButton = false }: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center border-b bg-card px-4 gap-4",
        className
      )}
    >
      {showMenuButton && (
        <Button variant="ghost" size="icon" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
      )}
      {children}
    </header>
  );
}

interface HeaderSearchProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  className?: string;
}

function HeaderSearch({
  placeholder = "Search...",
  value,
  onChange,
  onSearch,
  className,
}: HeaderSearchProps) {
  return (
    <div className={cn("relative flex-1 max-w-md", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSearch?.(value || "");
          }
        }}
        className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
      />
    </div>
  );
}

interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  time: string;
  read?: boolean;
  icon?: React.ReactNode;
}

interface HeaderNotificationsProps {
  notifications: NotificationItem[];
  onNotificationClick?: (notification: NotificationItem) => void;
  onMarkAllRead?: () => void;
  className?: string;
}

function HeaderNotifications({
  notifications,
  onNotificationClick,
  onMarkAllRead,
  className,
}: HeaderNotificationsProps) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("relative", className)}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => onNotificationClick?.(notification)}
                className="flex items-start gap-3 py-3 cursor-pointer"
              >
                {notification.icon && (
                  <span className="mt-0.5 flex-shrink-0">{notification.icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", !notification.read && "font-medium")}>
                      {notification.title}
                    </p>
                    {!notification.read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  {notification.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {notification.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">{notification.time}</p>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HeaderUserProps {
  name: string;
  email: string;
  avatar?: string;
  role?: string;
  onLogout?: () => void;
  actions?: { label: string; icon?: React.ReactNode; onClick?: () => void; destructive?: boolean }[];
  className?: string;
}

function HeaderUser({ name, email, avatar, role, onLogout, actions = [], className }: HeaderUserProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn("flex items-center gap-2 rounded-md p-1 hover:bg-accent transition-colors", className)}>
          <Avatar size="sm">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback>{getInitials(name)}</AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start">
            <span className="text-sm font-medium leading-none">{name}</span>
            {role && (
              <span className="text-xs text-muted-foreground leading-none mt-0.5">{role}</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Team</DropdownMenuItem>
        <DropdownMenuSeparator />
        {actions.map((action, i) => (
          <DropdownMenuItem
            key={i}
            onClick={action.onClick}
            className={cn(action.destructive && "text-destructive")}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </DropdownMenuItem>
        ))}
        {onLogout && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              Log out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface HeaderActionsProps {
  children: React.ReactNode;
  className?: string;
}

function HeaderActions({ children, className }: HeaderActionsProps) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

export { Header, HeaderSearch, HeaderNotifications, HeaderUser, HeaderActions };
