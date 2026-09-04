import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  label?: string;
  showValue?: boolean;
  showMarks?: boolean;
  marks?: { value: number; label?: string }[];
  error?: string;
  containerClassName?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, label, showValue = false, showMarks = false, marks = [], error, containerClassName, value, ...props }, ref) => {
  const sliderId = React.useId();
  const currentValue = value?.[0] ?? 0;

  return (
    <div className={cn("flex flex-col gap-2", containerClassName)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={sliderId} className="text-sm font-medium text-foreground">
              {label}
            </label>
          )}
          {showValue && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {currentValue}
            </span>
          )}
        </div>
      )}
      <SliderPrimitive.Root
        ref={ref}
        id={sliderId}
        className={cn(
          "relative flex w-full touch-none select-none items-center",
          error && "data-[disabled]:opacity-50",
          className
        )}
        value={value}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-secondary">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
      {showMarks && marks.length > 0 && (
        <div className="relative flex justify-between px-0.5">
          {marks.map((mark) => (
            <div
              key={mark.value}
              className="flex flex-col items-center"
            >
              <div className="h-1.5 w-0.5 bg-muted-foreground/30" />
              {mark.label && (
                <span className="mt-1 text-xs text-muted-foreground">
                  {mark.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

interface RangeSliderProps extends SliderProps {
  min?: number;
  max?: number;
}

const RangeSlider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(({ min = 0, max = 100, label, showValue, value, ...props }, ref) => {
  return (
    <Slider
      ref={ref}
      min={min}
      max={max}
      label={label}
      showValue={showValue}
      value={value}
      {...props}
    />
  );
});
RangeSlider.displayName = "RangeSlider";

export { Slider, RangeSlider };
