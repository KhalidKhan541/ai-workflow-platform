import { AIClient } from '@/lib/ai/client';

describe('AIClient', () => {
  let client: AIClient;

  beforeEach(() => {
    client = new AIClient({
      providers: {
        openai: { apiKey: 'sk-openai' },
        anthropic: { apiKey: 'sk-anthropic' },
      },
      defaultProvider: 'openai',
      defaultModel: 'gpt-4-turbo',
    });
    jest.restoreAllMocks();
  });

  describe('provider selection', () => {
    it('should select default provider when no preference', () => {
      expect(client.selectProvider()).toBe('openai');
    });

    it('should prefer specified provider if available', () => {
      expect(client.selectProvider(undefined, 'anthropic')).toBe('anthropic');
    });

    it('should fallback to default when preferred provider not configured', () => {
      expect(client.selectProvider(undefined, 'google')).toBe('openai');
    });

    it('should select based on priority when no preference', () => {
      const clientOnlyAnthropic = new AIClient({
        providers: { anthropic: { apiKey: 'key' } },
        defaultProvider: 'anthropic',
      });
      expect(clientOnlyAnthropic.selectProvider()).toBe('anthropic');
    });
  });

  describe('model selection', () => {
    it('should select embedding model for embedding tasks', () => {
      expect(client.selectModel('embedding', 'openai')).toBe('text-embedding-3-small');
    });

    it('should select code model for code tasks on openai', () => {
      expect(client.selectModel('code', 'openai')).toBe('gpt-4');
    });

    it('should select code model for code tasks on anthropic', () => {
      expect(client.selectModel('code', 'anthropic')).toBe('claude-3-opus');
    });

    it('should select creative model on anthropic', () => {
      expect(client.selectModel('creative', 'anthropic')).toBe('claude-3-opus');
    });

    it('should select chat model on google', () => {
      expect(client.selectModel('chat', 'google')).toBe('gemini-pro');
    });

    it('should use default model for unknown task', () => {
      expect(client.selectModel('unknown', 'openai')).toBe('gpt-4-turbo');
    });
  });

  describe('token estimation', () => {
    it('should estimate tokens based on character count', () => {
      expect(client.estimateTokens('')).toBe(0);
      expect(client.estimateTokens('abcd')).toBe(1);
      expect(client.estimateTokens('hello world')).toBe(3);
    });
  });

  describe('cost calculation', () => {
    it('should calculate cost for known model', () => {
      const cost = client.calculateCost(
        { promptTokens: 1000, completionTokens: 500, totalTokens: 1500, estimatedCost: 0 },
        'gpt-4',
      );
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeCloseTo(1000 * 0.00003 + 500 * 0.00006, 6);
    });

    it('should return 0 for unknown model', () => {
      const cost = client.calculateCost(
        { promptTokens: 1000, completionTokens: 500, totalTokens: 1500, estimatedCost: 0 },
        'unknown-model',
      );
      expect(cost).toBe(0);
    });
  });

  describe('getTotalUsage', () => {
    it('should return zeros when no usage', () => {
      const usage = client.getTotalUsage();
      expect(usage.promptTokens).toBe(0);
      expect(usage.completionTokens).toBe(0);
    });

    it('should accumulate usage after completions', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });

      await client.complete({ messages: [{ role: 'user', content: 'hello' }] });
      await client.complete({ messages: [{ role: 'user', content: 'world' }] });

      const usage = client.getTotalUsage();
      expect(usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('complete', () => {
    it('should return a completion response', async () => {
      const response = await client.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.id).toBeDefined();
      expect(response.provider).toBe('openai');
      expect(response.content).toContain('Mock completion');
      expect(response.finishReason).toBe('stop');
      expect(response.usage.promptTokens).toBeGreaterThan(0);
    });

    it('should throw for unconfigured provider', async () => {
      const emptyClient = new AIClient({
        providers: {},
        defaultProvider: 'openai',
      });

      await expect(
        emptyClient.complete({
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow('not configured');
    });

    it('should use specified provider', async () => {
      const response = await client.complete({
        messages: [{ role: 'user', content: 'test' }],
        provider: 'anthropic',
      });

      expect(response.provider).toBe('anthropic');
    });
  });

  describe('stream', () => {
    it('should yield stream chunks', async () => {
      const chunks = [];
      for await (const chunk of client.stream({
        messages: [{ role: 'user', content: 'test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].delta).toBeDefined();
      expect(chunks[chunks.length - 1].finishReason).toBe('stop');
    });

    it('should accumulate delta text', async () => {
      let fullText = '';
      for await (const chunk of client.stream({
        messages: [{ role: 'user', content: 'test' }],
      })) {
        fullText += chunk.delta;
      }

      expect(fullText.length).toBeGreaterThan(0);
    });
  });

  describe('hasProvider / getAvailableProviders', () => {
    it('should report available providers', () => {
      expect(client.hasProvider('openai')).toBe(true);
      expect(client.hasProvider('anthropic')).toBe(true);
      expect(client.hasProvider('google')).toBe(false);
    });

    it('should list available providers', () => {
      const providers = client.getAvailableProviders();
      expect(providers).toContain('openai');
      expect(providers).toContain('anthropic');
      expect(providers).not.toContain('google');
    });
  });

  describe('getModelConfig', () => {
    it('should return config for known model', () => {
      const config = client.getModelConfig('gpt-4');
      expect(config).toBeDefined();
      expect(config!.provider).toBe('openai');
      expect(config!.contextWindow).toBe(8192);
    });

    it('should return undefined for unknown model', () => {
      expect(client.getModelConfig('nonexistent')).toBeUndefined();
    });
  });
});
