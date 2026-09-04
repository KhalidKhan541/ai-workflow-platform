import * as React from "react";

interface UseKeyPressOptions {
  key?: string;
  keys?: string[];
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  enabled?: boolean;
  preventDefault?: boolean;
}

function useKeyPress(
  callback: (event: KeyboardEvent) => void,
  options: UseKeyPressOptions = {}
) {
  const {
    key,
    keys,
    ctrl = false,
    meta = false,
    shift = false,
    alt = false,
    enabled = true,
    preventDefault = true,
  } = options;

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check modifier keys
      if (ctrl && !event.ctrlKey) return;
      if (meta && !event.metaKey) return;
      if (shift && !event.shiftKey) return;
      if (alt && !event.altKey) return;

      // Check key
      if (key && event.key !== key) return;
      if (keys && !keys.includes(event.key)) return;

      if (preventDefault) {
        event.preventDefault();
      }

      callback(event);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callback, key, keys, ctrl, meta, shift, alt, enabled, preventDefault]);
}

function useHotkey(shortcut: string, callback: () => void, enabled = true) {
  const parseShortcut = React.useMemo(() => {
    const parts = shortcut.toLowerCase().split("+");
    return {
      key: parts.find((p) => !["ctrl", "meta", "shift", "alt", "cmd"].includes(p)),
      ctrl: parts.includes("ctrl") || parts.includes("cmd"),
      meta: parts.includes("meta") || parts.includes("cmd"),
      shift: parts.includes("shift"),
      alt: parts.includes("alt"),
    };
  }, [shortcut]);

  useKeyPress(callback, {
    ...parseShortcut,
    enabled,
  });
}

export { useKeyPress, useHotkey };
