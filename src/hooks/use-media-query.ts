import * as React from "react";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState<boolean>(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query, matches]);

  return matches;
}

function useBreakpoint() {
  const isSm = useMediaQuery("(min-width: 640px)");
  const isMd = useMediaQuery("(min-width: 768px)");
  const isLg = useMediaQuery("(min-width: 1024px)");
  const isXl = useMediaQuery("(min-width: 1280px)");
  const is2Xl = useMediaQuery("(min-width: 1536px)");

  if (is2Xl) return "2xl" as const;
  if (isXl) return "xl" as const;
  if (isLg) return "lg" as const;
  if (isMd) return "md" as const;
  if (isSm) return "sm" as const;
  return "xs" as const;
}

export { useMediaQuery, useBreakpoint };
