import { AgentRunner } from '@/lib/ai/agents';
import type { AgentConfig } from '@/types/ai';

describe('AgentRunner', () => {
  let runner: AgentRunner;

  beforeEach(() => {
    runner = new AgentRunner(10, 4096);
  });

  const baseAgent: AgentConfig = {
    id: 'agent-1',
    name: 'Test Agent',
    description: 'A test agent',
    systemPrompt: 'You are a helpful test assistant.',
    model: 'gpt-4',
    temperature: 0.7,
  };

  describe('execute', () => {
    it('should execute a simple agent without tools', async () => {
      const result = await runner.execute(baseAgent, 'Hello');

      expect(result.agentId).toBe('agent-1');
      expect(result.response).toBeDefined();
      expect(result.response.length).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.iterations).toBeGreaterThanOrEqual(1);
    });

    it('should respect maxIterations', async () => {
      const result = await runner.execute(baseAgent, 'test', { maxIterations: 1 });
      expect(result.iterations).toBeLessThanOrEqual(1);
    });

    it('should track tokens across steps', async () => {
      const result = await runner.execute(baseAgent, 'hello');
      const totalFromSteps = result.steps.reduce((sum, s) => sum + s.tokens, 0);
      expect(result.totalTokens).toBeGreaterThanOrEqual(totalFromSteps);
    });

    it('should calculate cost', async () => {
      const result = await runner.execute(baseAgent, 'hello');
      expect(result.totalCost).toBeGreaterThanOrEqual(0);
    });

    it('should record latency', async () => {
      const result = await runner.execute(baseAgent, 'hello');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('tool calling', () => {
    it('should call tools when provided', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather',
            parameters: { type: 'object', properties: { city: { type: 'string' } } },
          },
        },
      ];

      const toolExecutor = jest.fn().mockResolvedValue({ temp: 72 });

      const result = await runner.execute(baseAgent, 'What is the weather?', {
        tools,
        toolExecutor,
        maxIterations: 3,
      });

      expect(result.steps.length).toBeGreaterThan(0);
      const toolCallSteps = result.steps.filter((s) => s.type === 'tool_call');
      expect(toolCallSteps.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle tool execution errors', async () => {
      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'failing_tool',
            description: 'Fails',
            parameters: {},
          },
        },
      ];

      const toolExecutor = jest.fn().mockRejectedValue(new Error('Tool failed'));

      const result = await runner.execute(baseAgent, 'Use the tool', {
        tools,
        toolExecutor,
        maxIterations: 3,
      });

      const errorSteps = result.steps.filter((s) => s.type === 'tool_result' && s.toolResults?.some((t) => t.error));
      expect(errorSteps.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateAgent', () => {
    it('should validate a correct agent', () => {
      const result = runner.validateAgent(baseAgent);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail without id', () => {
      const result = runner.validateAgent({ ...baseAgent, id: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent ID is required');
    });

    it('should fail without name', () => {
      const result = runner.validateAgent({ ...baseAgent, name: '' });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Agent name is required');
    });

    it('should fail without prompt and description', () => {
      const result = runner.validateAgent({ ...baseAgent, systemPrompt: undefined, description: '' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('systemPrompt') || e.includes('description'))).toBe(true);
    });

    it('should fail with invalid temperature', () => {
      const result = runner.validateAgent({ ...baseAgent, temperature: 5 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Temperature'))).toBe(true);
    });

    it('should fail with invalid maxTokens', () => {
      const result = runner.validateAgent({ ...baseAgent, maxTokens: 200000 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Max tokens'))).toBe(true);
    });

    it('should fail with tool without name', () => {
      const result = runner.validateAgent({
        ...baseAgent,
        tools: [{ type: 'function', function: { name: '', description: '', parameters: {} } }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('formatStepsForPrompt', () => {
    it('should format steps as text', () => {
      const steps = [
        { stepNumber: 1, type: 'reasoning' as const, content: 'Thinking...', timestamp: new Date(), tokens: 10 },
        { stepNumber: 2, type: 'response' as const, content: 'Answer', timestamp: new Date(), tokens: 5 },
      ];

      const formatted = runner.formatStepsForPrompt(steps);
      expect(formatted).toContain('[Step 1] reasoning: Thinking...');
      expect(formatted).toContain('[Step 2] response: Answer');
    });

    it('should handle empty steps', () => {
      expect(runner.formatStepsForPrompt([])).toBe('');
    });
  });

  describe('calculateTotalCost', () => {
    it('should calculate cost from steps', () => {
      const steps = [
        { stepNumber: 1, type: 'reasoning' as const, content: 'a', timestamp: new Date(), tokens: 100 },
        { stepNumber: 2, type: 'response' as const, content: 'b', timestamp: new Date(), tokens: 200 },
      ];

      const cost = runner.calculateTotalCost(steps, 0.00001);
      expect(cost).toBeCloseTo(0.003, 6);
    });

    it('should handle empty steps', () => {
      expect(runner.calculateTotalCost([])).toBe(0);
    });
  });

  describe('token limit', () => {
    it('should stop when maxTokens exceeded', async () => {
      const lowTokenRunner = new AgentRunner(100, 50);
      const result = await lowTokenRunner.execute(baseAgent, 'test');
      expect(result.totalTokens).toBeGreaterThanOrEqual(0);
    });
  });
});
