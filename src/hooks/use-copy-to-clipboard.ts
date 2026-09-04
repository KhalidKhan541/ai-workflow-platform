import * as React from "react";

interface UseCopyToClipboardReturn {
  copiedText: string | null;
  copy: (text: string) => Promise<boolean>;
  reset: () => void;
}

function useCopyToClipboard(): UseCopyToClipboardReturn {
  const [copiedText, setCopiedText] = React.useState<string | null>(null);

  const copy = React.useCallback(async (text: string): Promise<boolean> => {
    if (!navigator?.clipboard) {
      console.warn("Clipboard not supported");
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
      return true;
    } catch (error) {
      console.error("Failed to copy:", error);

      // Fallback for older browsers
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
        return true;
      } catch {
        return false;
      }
    }
  }, []);

  const reset = React.useCallback(() => {
    setCopiedText(null);
  }, []);

  return { copiedText, copy, reset };
}

export { useCopyToClipboard };
