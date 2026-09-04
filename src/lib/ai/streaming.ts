import type { StreamChunk, AIProvider, ToolCall } from "@/types/ai";

// ─── SSE Event Types ─────────────────────────────────────────────────────────

export interface SSEEvent {
  event?: string;
  data: string;
  id?: string;
  retry?: number;
}

// ─── Stream Buffer ───────────────────────────────────────────────────────────

export class StreamBuffer {
  private buffer: string = "";
  private decoder = new TextDecoder();

  append(chunk: Uint8Array): void {
    this.buffer += this.decoder.decode(chunk, { stream: true });
  }

  readLines(): string[] {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    return lines;
  }

  flush(): string {
    const remaining = this.buffer;
    this.buffer = "";
    return remaining;
  }
}

// ─── Provider-Specific Parsers ───────────────────────────────────────────────

export abstract class StreamParser {
  abstract provider: AIProvider;
  abstract parseLine(line: string, chunkId: string): StreamChunk | null;
  abstract isDone(line: string): boolean;
}

export class OpenAIStreamParser extends StreamParser {
  provider: AIProvider = "openai";

  parseLine(line: string, chunkId: string): StreamChunk | null {
    if (!line.startsWith("data: ")) return null;
    const data = line.slice(6);
    if (data === "[DONE]") return null;

    try {
      const parsed = JSON.parse(data);
      const choice = parsed.choices?.[0];
      if (!choice) return null;

      const toolCalls: Partial<ToolCall>[] | undefined =
        choice.delta?.tool_calls?.map((tc: Record<string, unknown>) => ({
          id: tc.id as string,
          type: "function" as const,
          function: {
            name: (tc.function as Record<string, string>)?.name,
            arguments: (tc.function as Record<string, string>)?.arguments,
          },
        }));

      return {
        id: parsed.id || chunkId,
        provider: this.provider,
        delta: choice.delta?.content ?? "",
        finishReason: choice.finish_reason ?? null,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: parsed.usage
          ? {
              promptTokens: parsed.usage.prompt_tokens,
              completionTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens,
            }
          : undefined,
      };
    } catch {
      return null;
    }
  }

  isDone(line: string): boolean {
    return line === "data: [DONE]";
  }
}

export class AnthropicStreamParser extends StreamParser {
  provider: AIProvider = "anthropic";

  private buffer: string = "";
  private currentToolCall: Partial<ToolCall> | null = null;

  parseLine(line: string, chunkId: string): StreamChunk | null {
    if (!line.startsWith("data: ")) return null;

    try {
      const parsed = JSON.parse(line.slice(6));

      switch (parsed.type) {
        case "content_block_delta":
          if (parsed.delta?.type === "text_delta") {
            return {
              id: chunkId,
              provider: this.provider,
              delta: parsed.delta.text ?? "",
              finishReason: null,
            };
          }
          if (parsed.delta?.type === "input_json_delta") {
            return {
              id: chunkId,
              provider: this.provider,
              delta: "",
              finishReason: null,
              toolCalls: [{
                id: this.currentToolCall?.id ?? "",
                type: "function",
                function: {
                  name: this.currentToolCall?.function?.name ?? "",
                  arguments: parsed.delta.partial_json ?? "",
                },
              }],
            };
          }
          return null;

        case "content_block_start":
          if (parsed.content_block?.type === "tool_use") {
            this.currentToolCall = {
              id: parsed.content_block.id,
              type: "function",
              function: {
                name: parsed.content_block.name,
                arguments: "",
              },
            };
          }
          return null;

        case "message_delta":
          return {
            id: chunkId,
            provider: this.provider,
            delta: "",
            finishReason: this.mapStopReason(parsed.delta?.stop_reason),
            usage: parsed.usage
              ? { completionTokens: parsed.usage.output_tokens }
              : undefined,
          };

        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  isDone(line: string): boolean {
    return line === "data: [DONE]";
  }

  private mapStopReason(reason: string | undefined): StreamChunk["finishReason"] {
    switch (reason) {
      case "end_turn": return "stop";
      case "max_tokens": return "length";
      case "tool_use": return "tool_calls";
      default: return null;
    }
  }
}

export class GoogleStreamParser extends StreamParser {
  provider: AIProvider = "google";

  parseLine(line: string, chunkId: string): StreamChunk | null {
    if (!line.startsWith("data: ")) return null;

    try {
      const parsed = JSON.parse(line.slice(6));
      const candidate = parsed.candidates?.[0];
      if (!candidate) return null;

      const content = candidate.content?.parts?.[0];

      if (content?.text) {
        return {
          id: chunkId,
          provider: this.provider,
          delta: content.text,
          finishReason: candidate.finishReason === "STOP" ? "stop" : null,
        };
      }

      if (content?.functionCall) {
        return {
          id: chunkId,
          provider: this.provider,
          delta: "",
          finishReason: null,
          toolCalls: [{
            id: `toolcall_${Date.now()}`,
            type: "function",
            function: {
              name: content.functionCall.name,
              arguments: JSON.stringify(content.functionCall.args),
            },
          }],
        };
      }

      return {
        id: chunkId,
        provider: this.provider,
        delta: "",
        finishReason: candidate.finishReason === "STOP" ? "stop" : null,
      };
    } catch {
      return null;
    }
  }

  isDone(line: string): boolean {
    return line === "data: [DONE]";
  }
}

// ─── Parser Factory ──────────────────────────────────────────────────────────

export function createStreamParser(provider: AIProvider): StreamParser {
  switch (provider) {
    case "openai":
      return new OpenAIStreamParser();
    case "anthropic":
      return new AnthropicStreamParser();
    case "google":
      return new GoogleStreamParser();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

// ─── Stream Processor ────────────────────────────────────────────────────────

export interface StreamProcessorOptions {
  onChunk: (chunk: StreamChunk) => void;
  onError: (error: Error) => void;
  onDone: (fullText: string, usage?: { promptTokens: number; completionTokens: number }) => void;
  abortSignal?: AbortSignal;
}

export class StreamProcessor {
  private parser: StreamParser;
  private buffer: StreamBuffer;
  private options: StreamProcessorOptions;
  private fullText: string = "";
  private chunkId: string;
  private isAborted: boolean = false;
  private totalUsage: { promptTokens: number; completionTokens: number } | null = null;

  constructor(provider: AIProvider, options: StreamProcessorOptions) {
    this.parser = createStreamParser(provider);
    this.buffer = new StreamBuffer();
    this.options = options;
    this.chunkId = `stream_${Date.now()}`;

    if (options.abortSignal) {
      options.abortSignal.addEventListener("abort", () => {
        this.isAborted = true;
      });
    }
  }

  processChunk(chunk: Uint8Array): void {
    if (this.isAborted) return;

    this.buffer.append(chunk);
    const lines = this.buffer.readLines();

    for (const line of lines) {
      if (this.isAborted) return;

      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;

      if (this.parser.isDone(trimmed)) {
        this.finish();
        return;
      }

      const streamChunk = this.parser.parseLine(trimmed, this.chunkId);
      if (streamChunk) {
        this.fullText += streamChunk.delta;
        if (streamChunk.usage) {
          this.totalUsage = {
            promptTokens: streamChunk.usage.promptTokens ?? this.totalUsage?.promptTokens ?? 0,
            completionTokens: streamChunk.usage.completionTokens ?? this.totalUsage?.completionTokens ?? 0,
          };
        }
        this.options.onChunk(streamChunk);
      }
    }
  }

  private finish(): void {
    const remaining = this.buffer.flush().trim();
    if (remaining) {
      const finalChunk = this.parser.parseLine(remaining, this.chunkId);
      if (finalChunk) {
        this.fullText += finalChunk.delta;
      }
    }

    this.options.onDone(
      this.fullText,
      this.totalUsage ?? undefined
    );
  }

  getFullText(): string {
    return this.fullText;
  }
}

// ─── Streaming Fetch Helper ──────────────────────────────────────────────────

export async function* streamFromResponse(
  response: Response
): AsyncGenerator<Uint8Array> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function processStream(
  response: Response,
  provider: AIProvider,
  options: StreamProcessorOptions
): Promise<void> {
  const processor = new StreamProcessor(provider, options);

  try {
    for await (const chunk of streamFromResponse(response)) {
      processor.processChunk(chunk);
    }
    // Ensure we finish even if no [DONE] was received
    if (!processor.getFullText() || options.onDone) {
      options.onDone(processor.getFullText());
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      options.onDone(processor.getFullText());
    } else {
      options.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// ─── Reconnecting Stream ─────────────────────────────────────────────────────

export interface ReconnectConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class ReconnectingStream {
  private fetchFn: () => Promise<Response>;
  private provider: AIProvider;
  private options: StreamProcessorOptions;
  private reconnectConfig: ReconnectConfig;
  private abortController: AbortController;
  private retryCount: number = 0;

  constructor(
    fetchFn: () => Promise<Response>,
    provider: AIProvider,
    options: StreamProcessorOptions,
    reconnectConfig?: Partial<ReconnectConfig>
  ) {
    this.fetchFn = fetchFn;
    this.provider = provider;
    this.options = options;
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG, ...reconnectConfig };
    this.abortController = new AbortController();
  }

  async start(): Promise<void> {
    let lastError: Error | null = null;

    while (this.retryCount <= this.reconnectConfig.maxRetries) {
      try {
        const response = await this.fetchFn();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        await processStream(response, this.provider, {
          ...this.options,
          abortSignal: this.abortController.signal,
        });
        return; // Success
      } catch (error) {
        if (this.abortController.signal.aborted) return;

        lastError = error instanceof Error ? error : new Error(String(error));
        this.retryCount++;

        if (this.retryCount > this.reconnectConfig.maxRetries) break;

        const delay = Math.min(
          this.reconnectConfig.initialDelayMs * Math.pow(this.reconnectConfig.backoffMultiplier, this.retryCount - 1),
          this.reconnectConfig.maxDelayMs
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.options.onError(
      lastError ?? new Error("Stream failed after max retries")
    );
  }

  abort(): void {
    this.abortController.abort();
  }
}
