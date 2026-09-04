import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        md: "h-10 w-10 text-sm",
        lg: "h-12 w-12 text-base",
        xl: "h-16 w-16 text-lg",
        "2xl": "h-20 w-20 text-xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
    VariantProps<typeof avatarVariants> & {
      status?: "online" | "offline" | "away" | "busy";
    }
>(({ className, size, status, ...props }, ref) => (
  <div className="relative inline-flex">
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
    {status && (
      <span
        className={cn(
          "absolute bottom-0 right-0 rounded-full border-2 border-background",
          size === "xs" && "h-1.5 w-1.5",
          size === "sm" && "h-2 w-2",
          (!size || size === "md") && "h-2.5 w-2.5",
          size === "lg" && "h-3 w-3",
          size === "xl" && "h-3.5 w-3.5",
          size === "2xl" && "h-4 w-4",
          status === "online" && "bg-success",
          status === "offline" && "bg-muted-foreground",
          status === "away" && "bg-warning",
          status === "busy" && "bg-destructive"
        )}
      />
    )}
  </div>
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted font-medium",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface AvatarGroupProps {
  avatars: {
    src?: string;
    alt?: string;
    fallback?: string;
  }[];
  max?: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

function AvatarGroup({ avatars, max = 5, size = "md", className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const sizeClasses = {
    xs: "-ml-1.5 h-6 w-6 text-[10px]",
    sm: "-ml-2 h-8 w-8 text-xs",
    md: "-ml-2.5 h-10 w-10 text-sm",
    lg: "-ml-3 h-12 w-12 text-base",
    xl: "-ml-3.5 h-16 w-16 text-lg",
  };

  return (
    <div className={cn("flex items-center", className)}>
      {visible.map((avatar, index) => (
        <Avatar
          key={index}
          size={size}
          className={cn(sizeClasses[size], "ring-2 ring-background")}
        >
          {avatar.src && <AvatarImage src={avatar.src} alt={avatar.alt} />}
          <AvatarFallback>{avatar.fallback || "?"}</AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <Avatar
          size={size}
          className={cn(sizeClasses[size], "ring-2 ring-background")}
        >
          <AvatarFallback>+{remaining}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup, getInitials };
