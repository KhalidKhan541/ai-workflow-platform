import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from "lucide-react";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        info: "bg-info/10 text-info border-info/20 [&>svg]:text-info",
        success: "bg-success/10 text-success border-success/20 [&>svg]:text-success",
        warning: "bg-warning/10 text-warning border-warning/20 [&>svg]:text-warning",
        error: "bg-destructive/10 text-destructive border-destructive/20 [&>svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> &
    VariantProps<typeof alertVariants> & {
      icon?: React.ReactNode;
      closable?: boolean;
      onClose?: () => void;
    }
>(({ className, variant, icon, closable, onClose, children, ...props }, ref) => {
  const defaultIcons = {
    info: <Info className="h-4 w-4" />,
    success: <CheckCircle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    error: <AlertCircle className="h-4 w-4" />,
    default: null,
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon || (variant && defaultIcons[variant])}
      <div className="flex-1">{children}</div>
      {closable && (
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
});
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  )
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm [&_p]:leading-relaxed", className)} {...props} />
  )
);
AlertDescription.displayName = "AlertDescription";

interface InlineAlertProps {
  variant: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
}

function InlineAlert({ variant, children, className }: InlineAlertProps) {
  return (
    <Alert variant={variant} className={cn("py-2", className)}>
      {children}
    </Alert>
  );
}

export { Alert, AlertTitle, AlertDescription, InlineAlert, alertVariants };
