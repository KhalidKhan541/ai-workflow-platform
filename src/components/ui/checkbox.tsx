import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string;
  description?: string;
  error?: string;
  indeterminate?: boolean;
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, error, indeterminate, id, ...props }, ref) => {
  const checkboxId = id || React.useId();

  return (
    <div className="flex items-start gap-2">
      <CheckboxPrimitive.Root
        ref={ref}
        id={checkboxId}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
          error && "border-destructive",
          className
        )}
        checked={indeterminate ? "indeterminate" : props.checked}
        {...props}
      >
        <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
          {indeterminate ? (
            <Minus className="h-3 w-3" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description || error) && (
        <div className="flex flex-col gap-0.5 leading-none">
          {label && (
            <label
              htmlFor={checkboxId}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
});
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

interface CheckboxGroupProps {
  options: { value: string; label: string; description?: string; disabled?: boolean }[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

function CheckboxGroup({
  options,
  value = [],
  onValueChange,
  orientation = "vertical",
  className,
}: CheckboxGroupProps) {
  const handleCheckedChange = (optionValue: string, checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return;
    if (checked) {
      onValueChange?.([...value, optionValue]);
    } else {
      onValueChange?.(value.filter((v) => v !== optionValue));
    }
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col",
        className
      )}
    >
      {options.map((option) => (
        <Checkbox
          key={option.value}
          checked={value.includes(option.value)}
          onCheckedChange={(checked) => handleCheckedChange(option.value, checked)}
          disabled={option.disabled}
          label={option.label}
          description={option.description}
        />
      ))}
    </div>
  );
}

export { Checkbox, CheckboxGroup };
