import { z } from "zod";

// ─── Provider Types ──────────────────────────────────────────────────────────

export type AIProvider = "openai" | "anthropic" | "google";

export type ModelTier = "fast" | "balanced" | "powerful";

export type TaskType =
  | "chat"
  | "code"
  | "analysis"
  | "creative"
  | "embedding"
  | "vision"
  | "summarization"
  | "extraction"
  | "classification"
  | "translation";

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organization?: string;
  maxRetries?: number;
  timeout?: number;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  maxConcurrent: number;
}

export interface ModelConfig {
  provider: AIProvider;
  model: string;
  maxTokens: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  rateLimit: RateLimitConfig;
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsVision: boolean;
  contextWindow: number;
}

// ─── Message Types ───────────────────────────────────────────────────────────

export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Request/Response Types ──────────────────────────────────────────────────

export interface CompletionRequest {
  messages: AIMessage[];
  model?: string;
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  toolChoice?: "auto" | "none" | "required" | { type: "function"; function: { name: string } };
  responseFormat?: { type: "text" | "json_object" };
  user?: string;
}

export interface CompletionResponse {
  id: string;
  provider: AIProvider;
  model: string;
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  usage: TokenUsage;
  toolCalls?: ToolCall[];
  latencyMs: number;
  cached: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface StreamChunk {
  id: string;
  provider: AIProvider;
  delta: string;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  usage?: Partial<TokenUsage>;
  toolCalls?: Partial<ToolCall>[];
}

// ─── Tool Types ──────────────────────────────────────────────────────────────

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
  latencyMs: number;
}

// ─── Agent Types ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model?: string;
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
  maxSteps?: number;
  tools?: ToolDefinition[];
  memory?: MemoryConfig;
  reflection?: ReflectionConfig;
}

export interface MemoryConfig {
  maxMessages: number;
  maxTokens: number;
  summaryThreshold: number;
}

export interface ReflectionConfig {
  enabled: boolean;
  maxIterations: number;
  qualityThreshold: number;
}

export interface AgentStep {
  stepNumber: number;
  type: "reasoning" | "tool_call" | "tool_result" | "reflection" | "response";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
  tokens: number;
}

export interface AgentResult {
  agentId: string;
  response: string;
  steps: AgentStep[];
  totalTokens: number;
  totalCost: number;
  latencyMs: number;
  iterations: number;
}

// ─── RAG Types ───────────────────────────────────────────────────────────────

export type ChunkingStrategy = "fixed" | "recursive" | "semantic";

export interface ChunkingConfig {
  strategy: ChunkingStrategy;
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

export interface Document {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  tokenCount: number;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  document: Document;
}

export interface RAGConfig {
  chunking: ChunkingConfig;
  embeddingModel: string;
  embeddingProvider: AIProvider;
  topK: number;
  scoreThreshold: number;
  rerankEnabled: boolean;
  hybridSearchWeight: number;
}

// ─── Cache Types ─────────────────────────────────────────────────────────────

export interface CacheConfig {
  ttlSeconds: number;
  maxEntries: number;
  semanticSimilarity: boolean;
  similarityThreshold: number;
  strategy: "exact" | "semantic" | "hybrid";
}

export interface CacheEntry {
  key: string;
  response: CompletionResponse;
  embedding?: number[];
  createdAt: Date;
  expiresAt: Date;
  hitCount: number;
}

// ─── Evaluation Types ────────────────────────────────────────────────────────

export interface EvaluationResult {
  qualityScore: number;
  relevanceScore: number;
  safetyScore: number;
  hallucinationScore: number;
  latencyMs: number;
  tokenUsage: TokenUsage;
  issues: EvaluationIssue[];
}

export interface EvaluationIssue {
  type: "hallucination" | "irrelevance" | "unsafe_content" | "low_quality" | "token_limit";
  severity: "low" | "medium" | "high";
  description: string;
  suggestion?: string;
}

// ─── Prompt Types ────────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: PromptVariable[];
  examples?: FewShotExample[];
  metadata: Record<string, unknown>;
}

export interface PromptVariable {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface FewShotExample {
  input: Record<string, string>;
  output: string;
}

// ─── Config Schema ───────────────────────────────────────────────────────────

export const AIConfigSchema = z.object({
  providers: z.record(z.enum(["openai", "anthropic", "google"]), z.object({
    apiKey: z.string(),
    baseUrl: z.string().optional(),
    organization: z.string().optional(),
  })),
  defaultProvider: z.enum(["openai", "anthropic", "google"]),
  defaultModel: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().min(1).max(128000).default(4096),
  cache: z.object({
    enabled: z.boolean().default(true),
    ttlSeconds: z.number().default(3600),
  }).default({}),
  evaluation: z.object({
    enabled: z.boolean().default(false),
    minQualityScore: z.number().min(0).max(1).default(0.5),
  }).default({}),
});

export type AIConfig = z.infer<typeof AIConfigSchema>;
