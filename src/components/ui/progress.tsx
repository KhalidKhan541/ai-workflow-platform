import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  max?: number;
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
  indicatorClassName?: string;
  size?: "sm" | "md" | "lg";
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(
  (
    {
      className,
      value = 0,
      max = 100,
      showLabel = false,
      label,
      animated = false,
      indicatorClassName,
      size = "md",
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const sizeClasses = {
      sm: "h-1.5",
      md: "h-2.5",
      lg: "h-4",
    };

    return (
      <div className="w-full">
        {(showLabel || label) && (
          <div className="flex items-center justify-between mb-1.5">
            {label && <span className="text-sm font-medium text-foreground">{label}</span>}
            {showLabel && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {Math.round(percentage)}%
              </span>
            )}
          </div>
        )}
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            "relative w-full overflow-hidden rounded-full bg-secondary",
            sizeClasses[size],
            className
          )}
          {...props}
        >
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out",
              animated && "animate-pulse",
              indicatorClassName
            )}
            style={{ transform: `translateX(-${100 - percentage}%)` }}
          />
        </ProgressPrimitive.Root>
      </div>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

interface CircularProgressProps {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
  className?: string;
  indicatorClassName?: string;
  trackClassName?: string;
}

function CircularProgress({
  value = 0,
  max = 100,
  size = 64,
  strokeWidth = 4,
  showLabel = true,
  className,
  indicatorClassName,
  trackClassName,
}: CircularProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={cn("text-secondary", trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn("text-primary transition-all duration-300 ease-in-out", indicatorClassName)}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-medium">{Math.round(percentage)}%</span>
      )}
    </div>
  );
}

export { Progress, CircularProgress };
