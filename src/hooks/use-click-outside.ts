import * as React from "react";

function useClickOutside<T extends HTMLElement = HTMLElement>(
  handler: () => void,
  options?: {
    enabled?: boolean;
    exclude?: React.RefObject<HTMLElement>[];
  }
) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (options?.enabled === false) return;

    const handleClick = (event: MouseEvent) => {
      if (!ref.current) return;

      // Check if click is inside the element
      if (ref.current.contains(event.target as Node)) return;

      // Check if click is inside any excluded element
      if (options?.exclude) {
        for (const excludeRef of options.exclude) {
          if (excludeRef.current?.contains(event.target as Node)) {
            return;
          }
        }
      }

      handler();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handler();
      }
    };

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handler, options?.enabled, options?.exclude]);

  return ref;
}

export { useClickOutside };
