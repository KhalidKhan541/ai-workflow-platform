import * as React from "react";

interface UseFetchOptions<T> {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface UseFetchReturn<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  execute: (url?: string, options?: RequestInit) => Promise<T | null>;
  reset: () => void;
}

function useFetch<T = unknown>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    method = "GET",
    headers = {},
    body,
    immediate = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const execute = React.useCallback(
    async (fetchUrl?: string, fetchOptions?: RequestInit): Promise<T | null> => {
      const targetUrl = fetchUrl || url;
      if (!targetUrl) return null;

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(targetUrl, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: abortControllerRef.current.signal,
          ...fetchOptions,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
        onSuccess?.(result);
        return result;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [url, method, headers, body, onSuccess, onError]
  );

  const reset = React.useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (immediate && url) {
      execute();
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [url, immediate]);

  return { data, error, loading, execute, reset };
}

export { useFetch };
