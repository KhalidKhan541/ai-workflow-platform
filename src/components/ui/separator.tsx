import * as React from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/lib/utils";

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
));
Separator.displayName = SeparatorPrimitive.Root.displayName;

interface DividerProps {
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  orientation?: "horizontal" | "vertical";
}

function Divider({ label, icon, className, orientation = "horizontal" }: DividerProps) {
  if (orientation === "vertical") {
    return (
      <div className={cn("flex items-center", className)}>
        <Separator orientation="vertical" />
      </div>
    );
  }

  if (!label && !icon) {
    return <Separator className={className} />;
  }

  return (
    <div className={cn("relative flex items-center py-2", className)}>
      <div className="flex-grow border-t border-border" />
      <div className="flex items-center gap-2 px-3">
        {icon}
        {label && (
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        )}
      </div>
      <div className="flex-grow border-t border-border" />
    </div>
  );
}

export { Separator, Divider };
