import type { AIProvider, CompletionRequest, CompletionResponse, StreamChunk, TokenUsage, ModelConfig } from '@/types/ai';

export interface AIClientConfig {
  providers: Partial<Record<AIProvider, { apiKey: string; baseUrl?: string }>>;
  defaultProvider: AIProvider;
  defaultModel?: string;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'gpt-4': {
    provider: 'openai', model: 'gpt-4', maxTokens: 8192, costPerInputToken: 0.00003,
    costPerOutputToken: 0.00006, rateLimit: { requestsPerMinute: 60, tokensPerMinute: 90000, maxConcurrent: 5 },
    supportsStreaming: true, supportsTools: true, supportsVision: false, contextWindow: 8192,
  },
  'gpt-4-turbo': {
    provider: 'openai', model: 'gpt-4-turbo', maxTokens: 128000, costPerInputToken: 0.00001,
    costPerOutputToken: 0.00003, rateLimit: { requestsPerMinute: 60, tokensPerMinute: 150000, maxConcurrent: 5 },
    supportsStreaming: true, supportsTools: true, supportsVision: true, contextWindow: 128000,
  },
  'claude-3-opus': {
    provider: 'anthropic', model: 'claude-3-opus', maxTokens: 4096, costPerInputToken: 0.000015,
    costPerOutputToken: 0.000075, rateLimit: { requestsPerMinute: 40, tokensPerMinute: 100000, maxConcurrent: 4 },
    supportsStreaming: true, supportsTools: true, supportsVision: true, contextWindow: 200000,
  },
  'gemini-pro': {
    provider: 'google', model: 'gemini-pro', maxTokens: 8192, costPerInputToken: 0.00000025,
    costPerOutputToken: 0.0000005, rateLimit: { requestsPerMinute: 60, tokensPerMinute: 120000, maxConcurrent: 5 },
    supportsStreaming: true, supportsTools: true, supportsVision: false, contextWindow: 32000,
  },
};

const PROVIDER_PRIORITY: AIProvider[] = ['openai', 'anthropic', 'google'];

export class AIClient {
  private config: AIClientConfig;
  private usageHistory: TokenUsage[] = [];

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  selectProvider(taskType?: string, preferredProvider?: AIProvider): AIProvider {
    if (preferredProvider && this.config.providers[preferredProvider]) {
      return preferredProvider;
    }
    for (const provider of PROVIDER_PRIORITY) {
      if (this.config.providers[provider]) {
        return provider;
      }
    }
    return this.config.defaultProvider;
  }

  getModelConfig(model: string): ModelConfig | undefined {
    return MODEL_CONFIGS[model];
  }

  selectModel(taskType: string, provider: AIProvider): string {
    if (taskType === 'embedding') return 'text-embedding-3-small';
    if (taskType === 'code') return provider === 'anthropic' ? 'claude-3-opus' : 'gpt-4';
    if (taskType === 'creative') return provider === 'anthropic' ? 'claude-3-opus' : 'gpt-4-turbo';
    if (taskType === 'chat') return provider === 'google' ? 'gemini-pro' : 'gpt-4-turbo';
    return this.config.defaultModel || 'gpt-4-turbo';
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  calculateCost(usage: TokenUsage, model: string): number {
    const config = MODEL_CONFIGS[model];
    if (!config) return 0;
    return usage.promptTokens * config.costPerInputToken + usage.completionTokens * config.costPerOutputToken;
  }

  getTotalUsage(): TokenUsage {
    return this.usageHistory.reduce(
      (acc, u) => ({
        promptTokens: acc.promptTokens + u.promptTokens,
        completionTokens: acc.completionTokens + u.completionTokens,
        totalTokens: acc.totalTokens + u.totalTokens,
        estimatedCost: acc.estimatedCost + u.estimatedCost,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, estimatedCost: 0 },
    );
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const provider = request.provider || this.selectProvider(undefined, request.provider);
    const model = request.model || this.selectModel('chat', provider);
    const startTime = Date.now();

    const providerConfig = this.config.providers[provider];
    if (!providerConfig) {
      throw new Error(`Provider '${provider}' is not configured`);
    }

    const promptTokens = this.estimateTokens(
      request.messages.map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join(''),
    );

    const completionTokens = Math.floor(Math.random() * 500) + 100;
    const usage: TokenUsage = {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCost: this.calculateCost({ promptTokens, completionTokens, totalTokens: promptTokens + completionTokens, estimatedCost: 0 }, model),
    };
    this.usageHistory.push(usage);

    return {
      id: `cmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider,
      model,
      content: `Mock completion response for: ${request.messages[request.messages.length - 1]?.content}`,
      finishReason: 'stop',
      usage,
      latencyMs: Date.now() - startTime,
      cached: false,
    };
  }

  async *stream(request: CompletionRequest): AsyncGenerator<StreamChunk> {
    const provider = request.provider || this.selectProvider(undefined, request.provider);
    const model = request.model || this.selectModel('chat', provider);
    const id = `cmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const words = 'This is a streaming response from the AI client'.split(' ');
    for (let i = 0; i < words.length; i++) {
      yield {
        id,
        provider,
        delta: (i === 0 ? '' : ' ') + words[i],
        finishReason: i === words.length - 1 ? 'stop' : null,
        usage: i === words.length - 1 ? { completionTokens: words.length } : undefined,
      };
    }
  }

  hasProvider(provider: AIProvider): boolean {
    return !!this.config.providers[provider];
  }

  getAvailableProviders(): AIProvider[] {
    return PROVIDER_PRIORITY.filter((p) => this.config.providers[p]);
  }
}
