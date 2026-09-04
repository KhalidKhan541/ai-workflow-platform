import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    label?: string;
    error?: string;
  }
>(({ className, label, error, ...props }, ref) => {
  const groupId = React.useId();
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <RadioGroupPrimitive.Root
        className={cn("grid gap-2", className)}
        {...props}
        ref={ref}
        aria-labelledby={label ? groupId : undefined}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    label?: string;
    description?: string;
  }
>(({ className, label, description, id, ...props }, ref) => {
  const itemId = id || React.useId();

  return (
    <div className="flex items-start gap-2">
      <RadioGroupPrimitive.Item
        ref={ref}
        id={itemId}
        className={cn(
          "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-2.5 w-2.5 fill-current text-current" />
        </RadioGroupPrimitive.Indicator>
      </RadioGroupPrimitive.Item>
      {(label || description) && (
        <div className="flex flex-col gap-0.5 leading-none">
          {label && (
            <label
              htmlFor={itemId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    </div>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface RadioGroupWithOptionsProps {
  options: RadioOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: "horizontal" | "vertical";
  label?: string;
  error?: string;
  className?: string;
}

function RadioGroupWithOptions({
  options,
  value,
  onValueChange,
  orientation = "vertical",
  label,
  error,
  className,
}: RadioGroupWithOptionsProps) {
  return (
    <RadioGroup value={value} onValueChange={onValueChange} label={label} error={error}>
      <div
        className={cn(
          "flex gap-3",
          orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col",
          className
        )}
      >
        {options.map((option) => (
          <RadioGroupItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            label={option.label}
            description={option.description}
          />
        ))}
      </div>
    </RadioGroup>
  );
}

export { RadioGroup, RadioGroupItem, RadioGroupWithOptions };
