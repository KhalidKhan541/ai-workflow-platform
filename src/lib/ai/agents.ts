import type {
  AgentConfig,
  AgentStep,
  AgentResult,
  AIMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  CompletionResponse,
  MemoryConfig,
  ReflectionConfig,
} from "@/types/ai";
import { AIClient } from "./client";
import { ToolRegistry, createDefaultToolRegistry } from "./tools";

// ─── Agent Memory ────────────────────────────────────────────────────────────

export class AgentMemory {
  private messages: AIMessage[] = [];
  private config: MemoryConfig;

  constructor(config: Partial<MemoryConfig> = {}) {
    this.config = {
      maxMessages: config.maxMessages ?? 50,
      maxTokens: config.maxTokens ?? 4000,
      summaryThreshold: config.summaryThreshold ?? 30,
    };
  }

  add(message: AIMessage): void {
    this.messages.push(message);
    if (this.messages.length > this.config.maxMessages) {
      this.trim();
    }
  }

  getMessages(): AIMessage[] {
    return [...this.messages];
  }

  getRecent(count: number): AIMessage[] {
    return this.messages.slice(-count);
  }

  getContext(): AIMessage[] {
    return this.messages.filter(
      (m) => m.role === "system" || m.role === "user" || m.role === "assistant"
    );
  }

  async summarize(client: AIClient): Promise<string> {
    const messages = this.getMessages();
    if (messages.length < this.config.summaryThreshold) {
      return "";
    }

    const conversationText = messages
      .map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content)}`)
      .join("\n");

    const response = await client.complete({
      messages: [
        {
          role: "system",
          content: "Summarize the following conversation concisely, capturing key points and decisions.",
        },
        {
          role: "user",
          content: conversationText,
        },
      ],
      maxTokens: 500,
      temperature: 0.3,
    });

    return response.content;
  }

  clear(): void {
    this.messages = [];
  }

  private trim(): void {
    // Keep first system message and last N messages
    const systemMessages = this.messages.filter((m) => m.role === "system");
    const nonSystemMessages = this.messages.filter((m) => m.role !== "system");

    const keepCount = this.config.maxMessages - systemMessages.length;
    this.messages = [
      ...systemMessages.slice(0, 1),
      ...nonSystemMessages.slice(-keepCount),
    ];
  }

  getTokenCount(): number {
    return this.messages.reduce((sum, m) => {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return sum + Math.ceil(content.length / 4);
    }, 0);
  }
}

// ─── Reflection Engine ───────────────────────────────────────────────────────

export interface ReflectionResult {
  shouldRetry: boolean;
  improvedPrompt: string;
  feedback: string;
  qualityScore: number;
}

export class ReflectionEngine {
  private config: ReflectionConfig;

  constructor(config: Partial<ReflectionConfig> = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      maxIterations: config.maxIterations ?? 3,
      qualityThreshold: config.qualityThreshold ?? 0.7,
    };
  }

  async evaluate(
    client: AIClient,
    originalPrompt: string,
    response: string,
    criteria?: string
  ): Promise<ReflectionResult> {
    const evaluationCriteria = criteria ?? `
      Evaluate the response on:
      1. Accuracy - Is the information correct?
      2. Completeness - Does it fully address the question?
      3. Clarity - Is it well-organized and easy to understand?
      4. Relevance - Does it stay on topic?
      Score each criterion 0-1 and provide an overall score.
      If the score is below 0.7, explain what needs improvement.
    `;

    const evalResponse = await client.complete({
      messages: [
        {
          role: "system",
          content: `You are a quality evaluator. Analyze the response and provide constructive feedback.\n\n${evaluationCriteria}`,
        },
        {
          role: "user",
          content: `Original prompt: ${originalPrompt}\n\nResponse to evaluate: ${response}`,
        },
      ],
      maxTokens: 1000,
      temperature: 0.2,
    });

    const scoreMatch = evalResponse.content.match(/(?:overall\s+)?score[:\s]*(\d+\.?\d*)/i);
    const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.5;

    const shouldRetry = score < this.config.qualityThreshold;

    let improvedPrompt = originalPrompt;
    if (shouldRetry) {
      improvedPrompt = `${originalPrompt}\n\n[Refinement: ${evalResponse.content}]`;
    }

    return {
      shouldRetry,
      improvedPrompt,
      feedback: evalResponse.content,
      qualityScore: score,
    };
  }
}

// ─── Tool Result Processor ───────────────────────────────────────────────────

export class ToolResultProcessor {
  static formatResults(results: ToolResult[]): string {
    return results
      .map((r) => {
        if (r.error) {
          return `Tool "${r.name}" error: ${r.error}`;
        }
        return `Tool "${r.name}" result: ${typeof r.result === "string" ? r.result : JSON.stringify(r.result)}`;
      })
      .join("\n\n");
  }

  static filterErrors(results: ToolResult[]): ToolResult[] {
    return results.filter((r) => r.error);
  }

  static summarizeResults(results: ToolResult[]): {
    successful: number;
    failed: number;
    totalLatencyMs: number;
  } {
    return {
      successful: results.filter((r) => !r.error).length,
      failed: results.filter((r) => r.error).length,
      totalLatencyMs: results.reduce((sum, r) => sum + r.latencyMs, 0),
    };
  }
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export class Agent {
  private config: AgentConfig;
  private client: AIClient;
  private registry: ToolRegistry;
  private memory: AgentMemory;
  private reflection: ReflectionEngine;

  constructor(
    config: AgentConfig,
    client: AIClient,
    toolRegistry?: ToolRegistry
  ) {
    this.config = {
      temperature: 0.7,
      maxTokens: 4096,
      maxSteps: 10,
      ...config,
    };
    this.client = client;
    this.registry = toolRegistry ?? createDefaultToolRegistry();
    this.memory = new AgentMemory(config.memory);
    this.reflection = new ReflectionEngine(config.reflection);
  }

  async run(
    input: string,
    options: { context?: Record<string, unknown>; maxIterations?: number } = {}
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let totalTokens = 0;
    let iterations = 0;

    // Initialize memory with system prompt
    this.memory.add({ role: "system", content: this.config.systemPrompt });
    this.memory.add({ role: "user", content: input });

    const maxIterations = options.maxIterations ?? this.config.maxSteps ?? 10;

    while (iterations < maxIterations) {
      iterations++;

      const messages = this.memory.getMessages();
      const tools = this.config.tools ?? this.registry.getDefinitions();

      // Step 1: Get LLM response
      const response = await this.client.complete({
        messages,
        model: this.config.model,
        provider: this.config.provider,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        tools: tools.length > 0 ? tools : undefined,
      });

      totalTokens += response.usage.totalTokens;

      steps.push({
        stepNumber: iterations,
        type: "reasoning",
        content: response.content,
        timestamp: new Date(),
        tokens: response.usage.totalTokens,
      });

      // Step 2: Check for tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolResults: ToolResult[] = [];

        for (const toolCall of response.toolCalls) {
          steps.push({
            stepNumber: iterations,
            type: "tool_call",
            content: `Calling tool: ${toolCall.function.name}`,
            toolCalls: [toolCall],
            timestamp: new Date(),
            tokens: 0,
          });

          let args: Record<string, unknown>;
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          const result = await this.registry.execute(
            toolCall.function.name,
            args,
            {
              userId: "",
              workspaceId: "",
              variables: (options.context as Record<string, string>) ?? {},
            }
          );

          result.toolCallId = toolCall.id;
          toolResults.push(result);

          steps.push({
            stepNumber: iterations,
            type: "tool_result",
            content: ToolResultProcessor.formatResults([result]),
            toolResults: [result],
            timestamp: new Date(),
            tokens: 0,
          });
        }

        // Add tool results to memory
        this.memory.add({
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls,
        });

        const toolResultsContent = ToolResultProcessor.formatResults(toolResults);
        this.memory.add({
          role: "tool",
          content: toolResultsContent,
          toolCallId: response.toolCalls[0]?.id,
        });

        // Check if we should continue or return
        const hasErrors = ToolResultProcessor.filterErrors(toolResults).length > 0;
        if (hasErrors && iterations > 1) {
          // On error after first tool call, try to handle it
          continue;
        }
      } else {
        // No tool calls - this is the final response
        this.memory.add({
          role: "assistant",
          content: response.content,
        });

        // Reflection loop
        if (this.config.reflection?.enabled && iterations === 1) {
          const reflection = await this.reflection.evaluate(
            this.client,
            input,
            response.content
          );

          if (reflection.shouldRetry && iterations < maxIterations) {
            steps.push({
              stepNumber: iterations,
              type: "reflection",
              content: `Reflection feedback: ${reflection.feedback}`,
              timestamp: new Date(),
              tokens: 0,
            });

            this.memory.add({
              role: "user",
              content: `Please improve your response based on this feedback: ${reflection.feedback}`,
            });
            continue;
          }
        }

        // Return final response
        return {
          agentId: this.config.id,
          response: response.content,
          steps,
          totalTokens,
          totalCost: response.usage.estimatedCost,
          latencyMs: Date.now() - startTime,
          iterations,
        };
      }
    }

    // Max iterations reached
    const lastAssistantMsg = [...this.memory.getMessages()]
      .reverse()
      .find((m) => m.role === "assistant");

    return {
      agentId: this.config.id,
      response: typeof lastAssistantMsg?.content === "string"
        ? lastAssistantMsg.content
        : "I was unable to complete the task within the allowed iterations.",
      steps,
      totalTokens,
      totalCost: 0,
      latencyMs: Date.now() - startTime,
      iterations,
    };
  }

  clearMemory(): void {
    this.memory.clear();
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }
}

// ─── Agent Orchestrator ──────────────────────────────────────────────────────

export interface OrchestratorConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  failoverStrategy: "skip" | "retry" | "fallback";
}

export class AgentOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private config: OrchestratorConfig;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 5,
      defaultTimeout: config.defaultTimeout ?? 60000,
      failoverStrategy: config.failoverStrategy ?? "skip",
    };
  }

  registerAgent(agent: Agent): void {
    this.agents.set(agent.getConfig().id, agent);
  }

  unregisterAgent(agentId: string): void {
    this.agents.delete(agentId);
  }

  async runAgent(
    agentId: string,
    input: string,
    options?: { context?: Record<string, unknown> }
  ): Promise<AgentResult> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    return agent.run(input, options);
  }

  async runSequential(
    agentIds: string[],
    initialInput: string,
    options?: { context?: Record<string, unknown> }
  ): Promise<{ agentId: string; result: AgentResult }[]> {
    const results: { agentId: string; result: AgentResult }[] = [];
    let currentInput = initialInput;
    const context = { ...options?.context };

    for (const agentId of agentIds) {
      try {
        const result = await this.runAgent(agentId, currentInput, { context });
        results.push({ agentId, result });

        // Pass output as input to next agent
        currentInput = result.response;
        context.previousAgentOutput = result.response;
      } catch (error) {
        if (this.config.failoverStrategy === "skip") continue;
        if (this.config.failoverStrategy === "retry") {
          const result = await this.runAgent(agentId, currentInput, { context });
          results.push({ agentId, result });
          currentInput = result.response;
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  async runParallel(
    agentIds: string[],
    input: string,
    options?: { context?: Record<string, unknown> }
  ): Promise<Map<string, AgentResult>> {
    const results = new Map<string, AgentResult>();
    const chunks: string[][] = [];

    // Split into chunks based on max concurrent
    for (let i = 0; i < agentIds.length; i += this.config.maxConcurrent) {
      chunks.push(agentIds.slice(i, i + this.config.maxConcurrent));
    }

    for (const chunk of chunks) {
      const promises = chunk.map(async (agentId) => {
        try {
          const result = await this.runAgent(agentId, input, options);
          return { agentId, result };
        } catch (error) {
          if (this.config.failoverStrategy === "skip") {
            return null;
          }
          throw error;
        }
      });

      const chunkResults = await Promise.all(promises);
      for (const r of chunkResults) {
        if (r) {
          results.set(r.agentId, r.result);
        }
      }
    }

    return results;
  }

  async runPipeline(
    steps: { agentId: string; input?: string | ((prevResult: AgentResult) => string) }[]
  ): Promise<AgentResult[]> {
    const results: AgentResult[] = [];
    let currentInput = "";

    for (const step of steps) {
      const input = typeof step.input === "function"
        ? step.input(results[results.length - 1])
        : (step.input ?? currentInput);

      const result = await this.runAgent(step.agentId, input);
      results.push(result);
      currentInput = result.response;
    }

    return results;
  }

  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createAgent(
  config: AgentConfig,
  client: AIClient
): Agent {
  return new Agent(config, client);
}

export function createOrchestrator(
  config?: Partial<OrchestratorConfig>
): AgentOrchestrator {
  return new AgentOrchestrator(config);
}
