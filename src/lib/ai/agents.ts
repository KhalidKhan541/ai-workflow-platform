import type { AgentConfig, AgentStep, AgentResult, ToolCall, ToolResult, ToolDefinition } from '@/types/ai';

export interface AgentExecutor {
  execute(agent: AgentConfig, input: string, tools?: ToolDefinition[]): Promise<AgentResult>;
}

export class AgentRunner {
  private maxSteps: number;
  private maxTokens: number;

  constructor(maxSteps: number = 10, maxTokens: number = 4096) {
    this.maxSteps = maxSteps;
    this.maxTokens = maxTokens;
  }

  async execute(
    agent: AgentConfig,
    input: string,
    options: {
      tools?: ToolDefinition[];
      toolExecutor?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      maxIterations?: number;
    } = {},
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    const maxIter = options.maxIterations ?? agent.maxSteps ?? this.maxSteps;
    let totalTokens = 0;
    let iterations = 0;
    let response = '';

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: agent.systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: input },
    ];

    while (iterations < maxIter) {
      iterations++;
      const stepTokens = Math.floor(Math.random() * 200) + 50;
      totalTokens += stepTokens;

      if (totalTokens > this.maxTokens) {
        steps.push({
          stepNumber: iterations,
          type: 'reasoning',
          content: 'Max tokens reached, stopping.',
          timestamp: new Date(),
          tokens: stepTokens,
        });
        break;
      }

      const shouldCallTool = options.tools && options.tools.length > 0 && iterations <= options.tools.length && Math.random() > 0.3;

      if (shouldCallTool && options.tools && options.toolExecutor) {
        const tool = options.tools[iterations - 1];
        const toolCall: ToolCall = {
          id: `call_${iterations}`,
          type: 'function',
          function: { name: tool.function.name, arguments: '{}' },
        };

        steps.push({
          stepNumber: iterations,
          type: 'tool_call',
          content: `Calling tool: ${tool.function.name}`,
          toolCalls: [toolCall],
          timestamp: new Date(),
          tokens: stepTokens,
        });

        try {
          const result = await options.toolExecutor(tool.function.name, {});
          const toolResult: ToolResult = {
            toolCallId: toolCall.id,
            name: tool.function.name,
            result,
            latencyMs: Math.floor(Math.random() * 100),
          };

          steps.push({
            stepNumber: iterations + 1,
            type: 'tool_result',
            content: JSON.stringify(result),
            toolResults: [toolResult],
            timestamp: new Date(),
            tokens: 0,
          });
          iterations++;
        } catch (error) {
          steps.push({
            stepNumber: iterations + 1,
            type: 'tool_result',
            content: `Tool error: ${error instanceof Error ? error.message : String(error)}`,
            toolResults: [{
              toolCallId: toolCall.id,
              name: tool.function.name,
              result: null,
              error: error instanceof Error ? error.message : String(error),
              latencyMs: 0,
            }],
            timestamp: new Date(),
            tokens: 0,
          });
          iterations++;
        }
      } else {
        response = `Agent response after ${iterations} iterations for: ${input}`;
        steps.push({
          stepNumber: iterations,
          type: 'response',
          content: response,
          timestamp: new Date(),
          tokens: stepTokens,
        });
        break;
      }
    }

    const costPerToken = 0.00001;
    return {
      agentId: agent.id,
      response,
      steps,
      totalTokens,
      totalCost: totalTokens * costPerToken,
      latencyMs: Date.now() - startTime,
      iterations,
    };
  }

  validateAgent(agent: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!agent.id) errors.push('Agent ID is required');
    if (!agent.name) errors.push('Agent name is required');
    if (!agent.systemPrompt && !agent.description) errors.push('Either systemPrompt or description is required');
    if (agent.temperature !== undefined && (agent.temperature < 0 || agent.temperature > 2)) {
      errors.push('Temperature must be between 0 and 2');
    }
    if (agent.maxTokens !== undefined && (agent.maxTokens < 1 || agent.maxTokens > 128000)) {
      errors.push('Max tokens must be between 1 and 128000');
    }
    if (agent.tools) {
      agent.tools.forEach((tool, i) => {
        if (!tool.function?.name) errors.push(`Tool at index ${i} must have a name`);
      });
    }
    return { valid: errors.length === 0, errors };
  }

  formatStepsForPrompt(steps: AgentStep[]): string {
    return steps
      .map((s) => `[Step ${s.stepNumber}] ${s.type}: ${s.content}`)
      .join('\n');
  }

  calculateTotalCost(steps: AgentStep[], costPerToken: number = 0.00001): number {
    return steps.reduce((sum, step) => sum + step.tokens * costPerToken, 0);
  }
}
