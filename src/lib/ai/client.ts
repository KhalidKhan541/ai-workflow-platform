import type {
  AIProvider,
  TaskType,
  ModelConfig,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  AIMessage,
  TokenUsage,
  RateLimitConfig,
} from "@/types/ai";
import {
  StreamProcessor,
  ReconnectingStream,
  processStream,
  type StreamProcessorOptions,
} from "./streaming";
import { AICache, createCache } from "./cache";
import { AIEvaluator } from "./evaluation";

// ─── Model Registry ──────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // OpenAI Models
  "gpt-4o": {
    provider: "openai",
    model: "gpt-4o",
    maxTokens: 128000,
    costPerInputToken: 0.0025,
    costPerOutputToken: 0.01,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 800000, maxConcurrent: 20 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 128000,
  },
  "gpt-4o-mini": {
    provider: "openai",
    model: "gpt-4o-mini",
    maxTokens: 128000,
    costPerInputToken: 0.00015,
    costPerOutputToken: 0.0006,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 2000000, maxConcurrent: 50 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 128000,
  },
  "gpt-4-turbo": {
    provider: "openai",
    model: "gpt-4-turbo",
    maxTokens: 128000,
    costPerInputToken: 0.01,
    costPerOutputToken: 0.03,
    rateLimit: { requestsPerMinute: 500, tokensPerMinute: 800000, maxConcurrent: 20 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 128000,
  },
  "gpt-3.5-turbo": {
    provider: "openai",
    model: "gpt-3.5-turbo",
    maxTokens: 16384,
    costPerInputToken: 0.0005,
    costPerOutputToken: 0.0015,
    rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 4000000, maxConcurrent: 100 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: false,
    contextWindow: 16384,
  },

  // Anthropic Models
  "claude-3-5-sonnet": {
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022",
    maxTokens: 200000,
    costPerInputToken: 0.003,
    costPerOutputToken: 0.015,
    rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 400000, maxConcurrent: 30 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 200000,
  },
  "claude-3-opus": {
    provider: "anthropic",
    model: "claude-3-opus-20240229",
    maxTokens: 200000,
    costPerInputToken: 0.015,
    costPerOutputToken: 0.075,
    rateLimit: { requestsPerMinute: 200, tokensPerMinute: 80000, maxConcurrent: 10 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 200000,
  },
  "claude-3-haiku": {
    provider: "anthropic",
    model: "claude-3-haiku-20240307",
    maxTokens: 200000,
    costPerInputToken: 0.00025,
    costPerOutputToken: 0.00125,
    rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 400000, maxConcurrent: 50 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 200000,
  },

  // Google Models
  "gemini-1.5-pro": {
    provider: "google",
    model: "gemini-1.5-pro",
    maxTokens: 2000000,
    costPerInputToken: 0.00125,
    costPerOutputToken: 0.005,
    rateLimit: { requestsPerMinute: 1000, tokensPerMinute: 4000000, maxConcurrent: 50 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 2000000,
  },
  "gemini-1.5-flash": {
    provider: "google",
    model: "gemini-1.5-flash",
    maxTokens: 1000000,
    costPerInputToken: 0.000075,
    costPerOutputToken: 0.0003,
    rateLimit: { requestsPerMinute: 2000, tokensPerMinute: 4000000, maxConcurrent: 100 },
    supportsStreaming: true,
    supportsTools: true,
    supportsVision: true,
    contextWindow: 1000000,
  },
};

// ─── Task-Based Model Selection ──────────────────────────────────────────────

const TASK_MODEL_MAP: Record<TaskType, string[]> = {
  chat: ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"],
  code: ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"],
  analysis: ["gpt-4o", "claude-3-opus", "gemini-1.5-pro"],
  creative: ["gpt-4o", "claude-3-opus", "gemini-1.5-pro"],
  embedding: ["text-embedding-3-small"],
  vision: ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"],
  summarization: ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"],
  extraction: ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"],
  classification: ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"],
  translation: ["gpt-4o-mini", "claude-3-haiku", "gemini-1.5-flash"],
};

export function selectModelForTask(task: TaskType, tier: "fast" | "balanced" | "powerful" = "balanced"): string {
  const models = TASK_MODEL_MAP[task] ?? TASK_MODEL_MAP.chat;
  const tierIndex = tier === "fast" ? 0 : tier === "balanced" ? 1 : 2;
  return models[Math.min(tierIndex, models.length - 1)];
}

// ─── Rate Limiter ────────────────────────────────────────────────────────────

class RateLimiter {
  private counters: Map<string, { requests: number; tokens: number; resetAt: number }> = new Map();
  private limits: Map<string, RateLimitConfig> = new Map();

  configure(provider: AIProvider, config: RateLimitConfig): void {
    this.limits.set(provider, config);
  }

  async acquire(provider: AIProvider, estimatedTokens: number = 1000): Promise<void> {
    const limit = this.limits.get(provider);
    if (!limit) return;

    const now = Date.now();
    let counter = this.counters.get(provider);

    if (!counter || now > counter.resetAt) {
      counter = { requests: 0, tokens: 0, resetAt: now + 60000 };
      this.counters.set(provider, counter);
    }

    // Check request limit
    if (counter.requests >= limit.requestsPerMinute) {
      const waitMs = counter.resetAt - now + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.acquire(provider, estimatedTokens);
    }

    // Check token limit
    if (counter.tokens + estimatedTokens > limit.tokensPerMinute) {
      const waitMs = counter.resetAt - now + 100;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return this.acquire(provider, estimatedTokens);
    }

    counter.requests++;
    counter.tokens += estimatedTokens;
  }
}

// ─── Provider Clients ────────────────────────────────────────────────────────

abstract class ProviderClient {
  abstract provider: AIProvider;
  abstract complete(request: CompletionRequest, model: string): Promise<CompletionResponse>;
  abstract stream(request: CompletionRequest, model: string): Promise<Response>;
}

class OpenAIClient extends ProviderClient {
  provider: AIProvider = "openai";
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  }

  async complete(request: CompletionRequest, model: string): Promise<CompletionResponse> {
    const startTime = Date.now();
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization ? { "OpenAI-Organization": this.config.organization } : {}),
      },
      body: JSON.stringify({
        model,
        messages: this.formatMessages(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        top_p: request.topP,
        frequency_penalty: request.frequencyPenalty,
        presence_penalty: request.presencePenalty,
        stop: request.stop,
        tools: request.tools,
        tool_choice: request.toolChoice,
        response_format: request.responseFormat,
      }),
      signal: AbortSignal.timeout(this.config.timeout ?? 60000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new OpenAIError(`API error: ${response.status}`, response.status, error);
    }

    const data = await response.json();
    const choice = data.choices[0];

    return {
      id: data.id,
      provider: this.provider,
      model: data.model,
      content: choice.message?.content ?? "",
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        estimatedCost: 0,
      },
      toolCalls: choice.message?.tool_calls,
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }

  async stream(request: CompletionRequest, model: string): Promise<Response> {
    return fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(this.config.organization ? { "OpenAI-Organization": this.config.organization } : {}),
      },
      body: JSON.stringify({
        model,
        messages: this.formatMessages(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        top_p: request.topP,
        stream: true,
        tools: request.tools,
        tool_choice: request.toolChoice,
      }),
    });
  }

  private formatMessages(messages: AIMessage[]): Record<string, unknown>[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    }));
  }

  private mapFinishReason(reason: string): CompletionResponse["finishReason"] {
    switch (reason) {
      case "stop": return "stop";
      case "length": return "length";
      case "tool_calls": return "tool_calls";
      case "content_filter": return "content_filter";
      default: return null;
    }
  }
}

class AnthropicClient extends ProviderClient {
  provider: AIProvider = "anthropic";
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com/v1";
  }

  async complete(request: CompletionRequest, model: string): Promise<CompletionResponse> {
    const startTime = Date.now();
    const { systemPrompt, messages } = this.extractSystemPrompt(request.messages);

    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP,
      stop_sequences: request.stop,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout ?? 60000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderError(`Anthropic API error: ${response.status}`, this.provider, response.status, error);
    }

    const data = await response.json();
    const content = data.content ?? [];
    const textContent = content.find((c: { type: string }) => c.type === "text")?.text ?? "";
    const toolUse = content.filter((c: { type: string }) => c.type === "tool_use");

    return {
      id: data.id,
      provider: this.provider,
      model: data.model,
      content: textContent,
      finishReason: this.mapStopReason(data.stop_reason),
      usage: {
        promptTokens: data.usage?.input_tokens ?? 0,
        completionTokens: data.usage?.output_tokens ?? 0,
        totalTokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
        estimatedCost: 0,
      },
      toolCalls: toolUse.length > 0
        ? toolUse.map((t: { id: string; name: string; input: unknown }) => ({
            id: t.id,
            type: "function" as const,
            function: {
              name: t.name,
              arguments: JSON.stringify(t.input),
            },
          }))
        : undefined,
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }

  async stream(request: CompletionRequest, model: string): Promise<Response> {
    const { systemPrompt, messages } = this.extractSystemPrompt(request.messages);

    const body: Record<string, unknown> = {
      model,
      messages: messages.map((m) => ({
        role: m.role === "tool" ? "user" : m.role,
        content: m.content,
      })),
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    if (systemPrompt) body.system = systemPrompt;

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    return fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
  }

  private extractSystemPrompt(messages: AIMessage[]): {
    systemPrompt: string | undefined;
    messages: AIMessage[];
  } {
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");
    return {
      systemPrompt: systemMessage?.content as string,
      messages: otherMessages,
    };
  }

  private mapStopReason(reason: string): CompletionResponse["finishReason"] {
    switch (reason) {
      case "end_turn": return "stop";
      case "max_tokens": return "length";
      case "tool_use": return "tool_calls";
      default: return null;
    }
  }
}

class GoogleClient extends ProviderClient {
  provider: AIProvider = "google";
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
  }

  async complete(request: CompletionRequest, model: string): Promise<CompletionResponse> {
    const startTime = Date.now();
    const { systemInstruction, contents } = this.formatMessages(request.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
        topP: request.topP,
        stopSequences: request.stop,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      }];
    }

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout ?? 60000),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderError(`Google API error: ${response.status}`, this.provider, response.status, error);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const textPart = parts.find((p: { text?: string }) => p.text);
    const functionCallPart = parts.find((p: { functionCall?: unknown }) => p.functionCall);

    return {
      id: `google_${Date.now()}`,
      provider: this.provider,
      model,
      content: textPart?.text ?? "",
      finishReason: candidate?.finishReason === "STOP" ? "stop" : null,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
        estimatedCost: 0,
      },
      toolCalls: functionCallPart
        ? [{
            id: `toolcall_${Date.now()}`,
            type: "function" as const,
            function: {
              name: functionCallPart.functionCall.name,
              arguments: JSON.stringify(functionCallPart.functionCall.args),
            },
          }]
        : undefined,
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }

  async stream(request: CompletionRequest, model: string): Promise<Response> {
    const { systemInstruction, contents } = this.formatMessages(request.messages);

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    return fetch(
      `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}&alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  }

  private formatMessages(messages: AIMessage[]): {
    systemInstruction: string | undefined;
    contents: Record<string, unknown>[];
  } {
    const systemMessage = messages.find((m) => m.role === "system");
    const otherMessages = messages.filter((m) => m.role !== "system");

    const contents = otherMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
    }));

    return {
      systemInstruction: systemMessage?.content as string | undefined,
      contents,
    };
  }
}

// ─── Error Classes ───────────────────────────────────────────────────────────

export class AIError extends Error {
  constructor(
    message: string,
    public provider: AIProvider,
    public statusCode?: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class OpenAIError extends AIError {
  constructor(message: string, statusCode: number, responseBody: string) {
    super(message, "openai", statusCode, responseBody);
    this.name = "OpenAIError";
  }
}

export class ProviderError extends AIError {
  constructor(
    message: string,
    provider: AIProvider,
    statusCode: number,
    responseBody: string
  ) {
    super(message, provider, statusCode, responseBody);
    this.name = "ProviderError";
  }
}

// ─── Fallback Chain ──────────────────────────────────────────────────────────

export interface FallbackConfig {
  providers: AIProvider[];
  retryOnFailure: boolean;
  maxRetries: number;
}

// ─── Cost Calculator ─────────────────────────────────────────────────────────

function calculateCost(
  modelConfig: ModelConfig,
  promptTokens: number,
  completionTokens: number
): number {
  return (
    (promptTokens * modelConfig.costPerInputToken +
      completionTokens * modelConfig.costPerOutputToken) /
    1000
  );
}

// ─── Main AI Client ──────────────────────────────────────────────────────────

export interface AIClientConfig {
  providers: Record<AIProvider, ProviderConfig>;
  defaultProvider: AIProvider;
  defaultModel?: string;
  fallback?: FallbackConfig;
  cache?: { enabled: boolean; ttlSeconds?: number };
  evaluation?: { enabled: boolean };
}

export class AIClient {
  private clients: Map<AIProvider, ProviderClient> = new Map();
  private rateLimiter = new RateLimiter();
  private cache: AICache;
  private evaluator: AIEvaluator;
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;

    // Initialize provider clients
    for (const [provider, providerConfig] of Object.entries(config.providers)) {
      switch (provider as AIProvider) {
        case "openai":
          this.clients.set("openai", new OpenAIClient(providerConfig));
          this.rateLimiter.configure("openai", MODEL_REGISTRY["gpt-4o"].rateLimit);
          break;
        case "anthropic":
          this.clients.set("anthropic", new AnthropicClient(providerConfig));
          this.rateLimiter.configure("anthropic", MODEL_REGISTRY["claude-3-5-sonnet"].rateLimit);
          break;
        case "google":
          this.clients.set("google", new GoogleClient(providerConfig));
          this.rateLimiter.configure("google", MODEL_REGISTRY["gemini-1.5-pro"].rateLimit);
          break;
      }
    }

    // Initialize cache
    this.cache = createCache({
      enabled: config.cache?.enabled ?? true,
      ttlSeconds: config.cache?.ttlSeconds ?? 3600,
    });

    // Initialize evaluator
    this.evaluator = new AIEvaluator();
  }

  async complete(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const provider = request.provider ?? this.config.defaultProvider;
    const model = request.model ?? this.config.defaultModel ?? this.getDefaultModel(provider);
    const modelConfig = MODEL_REGISTRY[model];

    // Check cache
    if (this.config.cache?.enabled !== false && !request.stream) {
      const cached = await this.cache.get(request);
      if (cached) return { ...cached, cached: true };
    }

    // Rate limiting
    const estimatedTokens = request.maxTokens ?? 4096;
    await this.rateLimiter.acquire(provider, estimatedTokens);

    // Get provider client
    const client = this.getClient(provider);

    try {
      const response = await client.complete(request, model);

      // Calculate cost
      if (modelConfig) {
        response.usage.estimatedCost = calculateCost(
          modelConfig,
          response.usage.promptTokens,
          response.usage.completionTokens
        );
      }

      // Evaluate if enabled
      if (this.config.evaluation?.enabled) {
        this.evaluator.evaluate(request, response);
      }

      // Cache response
      if (this.config.cache?.enabled !== false && !request.stream) {
        await this.cache.set(request, response);
      }

      return response;
    } catch (error) {
      // Try fallback chain
      if (this.config.fallback && this.config.fallback.retryOnFailure) {
        return this.tryFallback(request, error as Error);
      }
      throw error;
    }
  }

  async *stream(
    request: CompletionRequest
  ): AsyncGenerator<StreamChunk> {
    const provider = request.provider ?? this.config.defaultProvider;
    const model = request.model ?? this.config.defaultModel ?? this.getDefaultModel(provider);

    const client = this.getClient(provider);
    const response = await client.stream({ ...request, model }, model);

    if (!response.ok) {
      const error = await response.text();
      throw new ProviderError(
        `Stream error: ${response.status}`,
        provider,
        response.status,
        error
      );
    }

    const processor = new StreamProcessor(provider, {
      onChunk: () => {},
      onError: () => {},
      onDone: () => {},
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") return;

            try {
              const parsed = JSON.parse(data);
              const chunk = this.parseStreamChunk(parsed, provider, model);
              if (chunk) yield chunk;
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async streamWithCallback(
    request: CompletionRequest,
    options: StreamProcessorOptions
  ): Promise<void> {
    const provider = request.provider ?? this.config.defaultProvider;
    const model = request.model ?? this.config.defaultModel ?? this.getDefaultModel(provider);

    const client = this.getClient(provider);
    const response = await client.stream({ ...request, model }, model);

    if (!response.ok) {
      const error = await response.text();
      options.onError(
        new ProviderError(
          `Stream error: ${response.status}`,
          provider,
          response.status,
          error
        )
      );
      return;
    }

    await processStream(response, provider, options);
  }

  async completeWithFallback(
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    const fallbackConfig = this.config.fallback ?? {
      providers: [this.config.defaultProvider],
      retryOnFailure: true,
      maxRetries: 2,
    };

    const providers = [request.provider ?? this.config.defaultProvider, ...fallbackConfig.providers];
    const uniqueProviders = [...new Set(providers)];

    let lastError: Error | null = null;

    for (const provider of uniqueProviders) {
      try {
        return await this.complete({ ...request, provider });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError ?? new Error("All providers failed");
  }

  getModelConfig(model: string): ModelConfig | undefined {
    return MODEL_REGISTRY[model];
  }

  getAvailableModels(provider?: AIProvider): string[] {
    return Object.entries(MODEL_REGISTRY)
      .filter(([_, config]) => !provider || config.provider === provider)
      .map(([name]) => name);
  }

  getEvaluator(): AIEvaluator {
    return this.evaluator;
  }

  getCache(): AICache {
    return this.cache;
  }

  private getClient(provider: AIProvider): ProviderClient {
    const client = this.clients.get(provider);
    if (!client) {
      throw new AIError(
        `No client configured for provider: ${provider}`,
        provider
      );
    }
    return client;
  }

  private getDefaultModel(provider: AIProvider): string {
    const models = Object.entries(MODEL_REGISTRY)
      .filter(([_, config]) => config.provider === provider)
      .map(([name]) => name);
    return models[0] ?? "gpt-4o";
  }

  private async tryFallback(
    request: CompletionRequest,
    error: Error
  ): Promise<CompletionResponse> {
    const fallbackProviders = this.config.fallback?.providers ?? [];
    for (const provider of fallbackProviders) {
      try {
        return await this.complete({ ...request, provider });
      } catch {
        continue;
      }
    }
    throw error;
  }

  private parseStreamChunk(
    data: Record<string, unknown>,
    provider: AIProvider,
    model: string
  ): StreamChunk | null {
    switch (provider) {
      case "openai": {
        const choice = (data.choices as Record<string, unknown>[])?.[0];
        if (!choice) return null;
        return {
          id: (data.id as string) ?? "",
          provider,
          delta: ((choice.delta as Record<string, unknown>)?.content as string) ?? "",
          finishReason: (choice.finish_reason as StreamChunk["finishReason"]) ?? null,
        };
      }
      case "anthropic": {
        const delta = data.delta as Record<string, unknown> | undefined;
        if (delta?.type === "text_delta") {
          return {
            id: (data.id as string) ?? "",
            provider,
            delta: (delta.text as string) ?? "",
            finishReason: null,
          };
        }
        return null;
      }
      case "google": {
        const candidate = (data.candidates as Record<string, unknown>[])?.[0];
        const content = (candidate as Record<string, unknown>)?.content as Record<string, unknown> | undefined;
        const parts = content?.parts as Record<string, unknown>[] | undefined;
        const textPart = parts?.find((p) => p.text);
        return {
          id: (data.id as string) ?? "",
          provider,
          delta: (textPart?.text as string) ?? "",
          finishReason: ((candidate as Record<string, unknown>)?.finishReason === "STOP" ? "stop" : null),
        };
      }
      default:
        return null;
    }
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAIClient(config: AIClientConfig): AIClient {
  return new AIClient(config);
}

export function createAIClientFromEnv(): AIClient {
  const config: AIClientConfig = {
    providers: {} as Record<AIProvider, ProviderConfig>,
    defaultProvider: "openai",
    cache: { enabled: true },
    evaluation: { enabled: false },
  };

  if (process.env.OPENAI_API_KEY) {
    (config.providers as Record<string, ProviderConfig>).openai = {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL,
      organization: process.env.OPENAI_ORG_ID,
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    (config.providers as Record<string, ProviderConfig>).anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
  }

  if (process.env.GOOGLE_AI_API_KEY) {
    (config.providers as Record<string, ProviderConfig>).google = {
      apiKey: process.env.GOOGLE_AI_API_KEY,
    };
  }

  return new AIClient(config);
}
