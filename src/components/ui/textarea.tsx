import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  maxLength?: number;
  showCount?: boolean;
  autoResize?: boolean;
  containerClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      maxLength,
      showCount = false,
      autoResize = false,
      containerClassName,
      id,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const combinedRef = useCombinedRef(ref, textareaRef);
    const [charCount, setCharCount] = React.useState(0);
    const textareaId = id || React.useId();
    const hasError = !!error;

    React.useEffect(() => {
      if (typeof value === "string") {
        setCharCount(value.length);
      }
    }, [value]);

    React.useEffect(() => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [value, autoResize]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) return;
      setCharCount(newValue.length);
      onChange?.(e);
    };

    return (
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {props.required && <span className="text-destructive ml-1">*</span>}
          </label>
        )}
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            hasError && "border-destructive focus-visible:ring-destructive",
            autoResize && "resize-none overflow-hidden",
            className
          )}
          ref={combinedRef}
          id={textareaId}
          value={value}
          onChange={handleChange}
          {...props}
        />
        <div className="flex items-center justify-between">
          <div>
            {hasError && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {!hasError && helperText && (
              <p className="text-sm text-muted-foreground">{helperText}</p>
            )}
          </div>
          {showCount && (
            <p
              className={cn(
                "text-sm text-muted-foreground",
                maxLength && charCount >= maxLength * 0.9 && "text-warning",
                maxLength && charCount >= maxLength && "text-destructive"
              )}
            >
              {charCount}{maxLength ? `/${maxLength}` : ""}
            </p>
          )}
        </div>
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

function useCombinedRef<T>(...refs: (React.Ref<T> | undefined)[]): React.Ref<T> {
  return React.useCallback((element: T | null) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(element);
      } else {
        (ref as React.MutableRefObject<T | null>).current = element;
      }
    });
  }, refs);
}

export { Textarea };
