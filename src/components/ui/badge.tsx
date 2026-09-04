import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning: "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        info: "border-transparent bg-info text-info-foreground hover:bg-info/80",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
  removable?: boolean;
  onRemove?: () => void;
}

function Badge({ className, variant, size, icon, removable, onRemove, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon && <span className="mr-1">{icon}</span>}
      {children}
      {removable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface StatusBadgeProps {
  status: "active" | "inactive" | "pending" | "error" | "success" | "warning";
  label?: string;
  size?: "sm" | "md" | "lg";
  pulse?: boolean;
}

function StatusBadge({ status, label, size = "md", pulse = false }: StatusBadgeProps) {
  const variantMap: Record<string, "success" | "destructive" | "warning" | "info" | "default" | "secondary"> = {
    active: "success",
    success: "success",
    inactive: "secondary",
    pending: "warning",
    warning: "warning",
    error: "destructive",
  };

  const labelMap: Record<string, string> = {
    active: "Active",
    success: "Success",
    inactive: "Inactive",
    pending: "Pending",
    warning: "Warning",
    error: "Error",
  };

  return (
    <Badge variant={variantMap[status]} size={size}>
      <span className="relative flex h-2 w-2 mr-1.5">
        {pulse && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
            status === "success" || status === "active" ? "bg-success" :
            status === "error" ? "bg-destructive" :
            status === "pending" || status === "warning" ? "bg-warning" :
            "bg-primary"
          }`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${
          status === "success" || status === "active" ? "bg-success" :
          status === "error" ? "bg-destructive" :
          status === "pending" || status === "warning" ? "bg-warning" :
          status === "inactive" ? "bg-muted-foreground" :
          "bg-info"
        }`} />
      </span>
      {label || labelMap[status]}
    </Badge>
  );
}

export { Badge, badgeVariants, StatusBadge };
