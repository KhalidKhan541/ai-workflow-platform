import type {
  CompletionRequest,
  CompletionResponse,
  EvaluationResult,
  EvaluationIssue,
  TokenUsage,
} from "@/types/ai";

// ─── Quality Metrics ─────────────────────────────────────────────────────────

export interface QualityMetric {
  name: string;
  score: number;
  weight: number;
  details?: string;
}

export interface QualityReport {
  overallScore: number;
  metrics: QualityMetric[];
  timestamp: Date;
  responseId: string;
}

// ─── Response Quality Scorer ─────────────────────────────────────────────────

export class ResponseQualityScorer {
  private weights = {
    coherence: 0.25,
    relevance: 0.25,
    completeness: 0.2,
    clarity: 0.15,
    accuracy: 0.15,
  };

  score(
    request: CompletionRequest,
    response: CompletionResponse
  ): QualityReport {
    const metrics: QualityMetric[] = [];

    // Coherence check
    const coherence = this.checkCoherence(response.content);
    metrics.push({ name: "coherence", score: coherence, weight: this.weights.coherence });

    // Relevance check
    const relevance = this.checkRelevance(request, response);
    metrics.push({ name: "relevance", score: relevance, weight: this.weights.relevance });

    // Completeness check
    const completeness = this.checkCompleteness(response);
    metrics.push({ name: "completeness", score: completeness, weight: this.weights.completeness });

    // Clarity check
    const clarity = this.checkClarity(response.content);
    metrics.push({ name: "clarity", score: clarity, weight: this.weights.clarity });

    // Accuracy indicators
    const accuracy = this.checkAccuracyIndicators(response.content);
    metrics.push({ name: "accuracy", score: accuracy, weight: this.weights.accuracy });

    const overallScore = metrics.reduce(
      (sum, m) => sum + m.score * m.weight,
      0
    );

    return {
      overallScore,
      metrics,
      timestamp: new Date(),
      responseId: response.id,
    };
  }

  private checkCoherence(text: string): number {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length === 0) return 0;

    let score = 0.5;

    // Check for consistent topic
    const words = text.toLowerCase().split(/\s+/);
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }

    const topWords = Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topWords.length > 0) {
      score += 0.2;
    }

    // Check for paragraph structure
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.15;
    }

    // Check for transition words
    const transitions = ["however", "therefore", "additionally", "furthermore", "moreover"];
    const hasTransitions = transitions.some((t) => text.toLowerCase().includes(t));
    if (hasTransitions) {
      score += 0.15;
    }

    return Math.min(score, 1);
  }

  private checkRelevance(
    request: CompletionRequest,
    response: CompletionResponse
  ): number {
    const userMessages = request.messages.filter((m) => m.role === "user");
    if (userMessages.length === 0) return 0.5;

    const queryText = typeof userMessages[userMessages.length - 1].content === "string"
      ? userMessages[userMessages.length - 1].content
      : "";

    const queryWords = new Set(
      queryText.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );
    const responseWords = new Set(
      response.content.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    );

    const overlap = Array.from(queryWords).filter((w) => responseWords.has(w)).length;
    const ratio = queryWords.size > 0 ? overlap / queryWords.size : 0;

    return Math.min(0.3 + ratio * 0.7, 1);
  }

  private checkCompleteness(response: CompletionResponse): number {
    let score = 0.5;

    // Length check
    if (response.content.length > 100) score += 0.1;
    if (response.content.length > 500) score += 0.1;

    // Structure check (has headings, lists, etc.)
    if (/^#+\s/m.test(response.content)) score += 0.1;
    if (/^[-*]\s/m.test(response.content)) score += 0.1;
    if (/^\d+\.\s/m.test(response.content)) score += 0.1;

    return Math.min(score, 1);
  }

  private checkClarity(text: string): number {
    let score = 0.5;

    // Average sentence length
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const avgLength = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;

    if (avgLength < 30) score += 0.25;
    if (avgLength < 20) score += 0.25;

    return Math.min(score, 1);
  }

  private checkAccuracyIndicators(text: string): number {
    let score = 0.5;

    // Hedging language (can indicate uncertainty)
    const hedging = ["might", "possibly", "perhaps", "uncertain", "unsure"];
    const hedgingCount = hedging.filter((h) => text.toLowerCase().includes(h)).length;
    score -= hedgingCount * 0.05;

    // Confidence indicators
    const confident = ["definitely", "certainly", "always", "never"];
    const confidentCount = confident.filter((c) => text.toLowerCase().includes(c)).length;
    score += confidentCount * 0.05;

    // Numerical data (indicates specificity)
    if (/\d+/.test(text)) score += 0.1;

    return Math.max(0, Math.min(score, 1));
  }
}

// ─── Hallucination Detector ──────────────────────────────────────────────────

export interface HallucinationCheck {
  isHallucinated: boolean;
  confidence: number;
  indicators: string[];
}

export class HallucinationDetector {
  private factualPatterns: RegExp[] = [
    /\b(studies show|research indicates|according to|data shows)\b/i,
    /\b\d{4}\b/, // Years
    /\b\d+%\b/, // Percentages
  ];

  private opinionPatterns: RegExp[] = [
    /\b(I think|I believe|in my opinion|personally)\b/i,
    /\b(clearly|obviously|undoubtedly)\b/i,
  ];

  detect(text: string, context?: string): HallucinationCheck {
    const indicators: string[] = [];
    let confidence = 0;

    // Check for unverifiable claims
    for (const pattern of this.factualPatterns) {
      if (pattern.test(text)) {
        indicators.push(`Contains factual claim matching: ${pattern.source}`);
        confidence += 0.15;
      }
    }

    // Check for opinion presented as fact
    for (const pattern of this.opinionPatterns) {
      if (pattern.test(text)) {
        indicators.push(`Contains opinion pattern: ${pattern.source}`);
        confidence += 0.1;
      }
    }

    // Check for specific numbers without sources
    const numbers = text.match(/\b\d+(\.\d+)?\b/g) ?? [];
    if (numbers.length > 3) {
      indicators.push("Contains many specific numbers without attribution");
      confidence += 0.1;
    }

    // Check for internal consistency
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim());
    const contradictions = this.findContradictions(sentences);
    if (contradictions.length > 0) {
      indicators.push(...contradictions);
      confidence += 0.3;
    }

    return {
      isHallucinated: confidence > 0.5,
      confidence: Math.min(confidence, 1),
      indicators,
    };
  }

  private findContradictions(sentences: string[]): string[] {
    const contradictions: string[] = [];

    // Simple negation detection
    for (let i = 0; i < sentences.length; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        const a = sentences[i].toLowerCase().trim();
        const b = sentences[j].toLowerCase().trim();

        // Check if one is negation of the other
        if (a.includes("is") && b.includes("is not")) {
          const subject = a.split("is")[0].trim();
          if (b.includes(subject)) {
            contradictions.push(
              `Potential contradiction between: "${sentences[i].trim()}" and "${sentences[j].trim()}"`
            );
          }
        }
      }
    }

    return contradictions;
  }
}

// ─── Safety Filter ───────────────────────────────────────────────────────────

export interface SafetyCheck {
  isSafe: boolean;
  categories: Record<string, number>;
  flaggedContent: string[];
}

export class SafetyFilter {
  private categoryPatterns: Record<string, RegExp[]> = {
    violence: [/\b(kill|murder|assault|weapon|bomb)\b/i],
    hate: [/\b(slur|hate|discriminate|racist|sexist)\b/i],
    sexual: [/\b(sexual|explicit|nsfw|porn)\b/i],
    self_harm: [/\b(suicide|self-harm|cut|hurt myself)\b/i],
    illegal: [/\b(drug|hack|steal|fraud|scam)\b/i],
  };

  check(text: string): SafetyCheck {
    const categories: Record<string, number> = {};
    const flaggedContent: string[] = [];

    for (const [category, patterns] of Object.entries(this.categoryPatterns)) {
      let count = 0;
      for (const pattern of patterns) {
        const matches = text.match(pattern) ?? [];
        count += matches.length;
        if (matches.length > 0) {
          flaggedContent.push(...matches.map((m) => `[${category}] ${m}`));
        }
      }
      categories[category] = count;
    }

    const totalFlags = Object.values(categories).reduce((a, b) => a + b, 0);
    const isSafe = totalFlags === 0;

    return { isSafe, categories, flaggedContent };
  }
}

// ─── Cost Tracker ────────────────────────────────────────────────────────────

export interface CostEntry {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  requestId: string;
}

export class CostTracker {
  private entries: CostEntry[] = [];
  private modelCosts: Record<string, { input: number; output: number }> = {
    "gpt-4": { input: 0.03, output: 0.06 },
    "gpt-4-turbo": { input: 0.01, output: 0.03 },
    "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
    "claude-3-opus": { input: 0.015, output: 0.075 },
    "claude-3-sonnet": { input: 0.003, output: 0.015 },
    "claude-3-haiku": { input: 0.00025, output: 0.00125 },
    "gemini-pro": { input: 0.00025, output: 0.0005 },
  };

  record(entry: Omit<CostEntry, "timestamp">): CostEntry {
    const fullEntry: CostEntry = { ...entry, timestamp: new Date() };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs = this.modelCosts[model] ?? { input: 0.001, output: 0.002 };
    return (inputTokens * costs.input + outputTokens * costs.output) / 1000;
  }

  getTotalCost(period?: { start: Date; end: Date }): number {
    const filtered = period
      ? this.entries.filter(
          (e) => e.timestamp >= period.start && e.timestamp <= period.end
        )
      : this.entries;

    return filtered.reduce((sum, e) => sum + e.cost, 0);
  }

  getCostByProvider(): Record<string, number> {
    const byProvider: Record<string, number> = {};
    for (const entry of this.entries) {
      byProvider[entry.provider] = (byProvider[entry.provider] ?? 0) + entry.cost;
    }
    return byProvider;
  }

  getCostByModel(): Record<string, number> {
    const byModel: Record<string, number> = {};
    for (const entry of this.entries) {
      const key = `${entry.provider}/${entry.model}`;
      byModel[key] = (byModel[key] ?? 0) + entry.cost;
    }
    return byModel;
  }

  getDailyCosts(days: number = 30): { date: string; cost: number }[] {
    const now = new Date();
    const dailyCosts: Record<string, number> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dailyCosts[dateStr] = 0;
    }

    for (const entry of this.entries) {
      const dateStr = entry.timestamp.toISOString().split("T")[0];
      if (dateStr in dailyCosts) {
        dailyCosts[dateStr] += entry.cost;
      }
    }

    return Object.entries(dailyCosts)
      .map(([date, cost]) => ({ date, cost }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

// ─── Latency Monitor ─────────────────────────────────────────────────────────

export interface LatencyEntry {
  requestId: string;
  provider: string;
  model: string;
  latencyMs: number;
  firstTokenMs?: number;
  timestamp: Date;
}

export class LatencyMonitor {
  private entries: LatencyEntry[] = [];

  record(entry: Omit<LatencyEntry, "timestamp">): LatencyEntry {
    const fullEntry: LatencyEntry = { ...entry, timestamp: new Date() };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  getPercentile(provider: string, percentile: number): number {
    const providerEntries = this.entries
      .filter((e) => e.provider === provider)
      .map((e) => e.latencyMs)
      .sort((a, b) => a - b);

    if (providerEntries.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * providerEntries.length) - 1;
    return providerEntries[Math.max(0, index)];
  }

  getAverage(provider?: string): number {
    const filtered = provider
      ? this.entries.filter((e) => e.provider === provider)
      : this.entries;

    if (filtered.length === 0) return 0;
    return filtered.reduce((sum, e) => sum + e.latencyMs, 0) / filtered.length;
  }

  getStats(provider?: string): {
    count: number;
    average: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    const filtered = provider
      ? this.entries.filter((e) => e.provider === provider)
      : this.entries;

    if (filtered.length === 0) {
      return { count: 0, average: 0, p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const latencies = filtered.map((e) => e.latencyMs).sort((a, b) => a - b);

    return {
      count: filtered.length,
      average: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: this.percentile(latencies, 50),
      p90: this.percentile(latencies, 90),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
      min: latencies[0],
      max: latencies[latencies.length - 1],
    };
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// ─── Token Analytics ─────────────────────────────────────────────────────────

export interface TokenEntry {
  requestId: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  timestamp: Date;
}

export class TokenAnalytics {
  private entries: TokenEntry[] = [];

  record(entry: Omit<TokenEntry, "timestamp">): TokenEntry {
    const fullEntry: TokenEntry = { ...entry, timestamp: new Date() };
    this.entries.push(fullEntry);
    return fullEntry;
  }

  getTotalTokens(): { prompt: number; completion: number; total: number } {
    const prompt = this.entries.reduce((sum, e) => sum + e.promptTokens, 0);
    const completion = this.entries.reduce((sum, e) => sum + e.completionTokens, 0);
    return { prompt, completion, total: prompt + completion };
  }

  getTokensByModel(): Record<string, { prompt: number; completion: number }> {
    const byModel: Record<string, { prompt: number; completion: number }> = {};
    for (const entry of this.entries) {
      const key = `${entry.provider}/${entry.model}`;
      if (!byModel[key]) {
        byModel[key] = { prompt: 0, completion: 0 };
      }
      byModel[key].prompt += entry.promptTokens;
      byModel[key].completion += entry.completionTokens;
    }
    return byModel;
  }

  getAverageTokensPerRequest(provider?: string): {
    prompt: number;
    completion: number;
  } {
    const filtered = provider
      ? this.entries.filter((e) => e.provider === provider)
      : this.entries;

    if (filtered.length === 0) return { prompt: 0, completion: 0 };

    return {
      prompt: filtered.reduce((sum, e) => sum + e.promptTokens, 0) / filtered.length,
      completion: filtered.reduce((sum, e) => sum + e.completionTokens, 0) / filtered.length,
    };
  }
}

// ─── Comprehensive Evaluator ─────────────────────────────────────────────────

export class AIEvaluator {
  private qualityScorer = new ResponseQualityScorer();
  private hallucinationDetector = new HallucinationDetector();
  private safetyFilter = new SafetyFilter();
  private costTracker = new CostTracker();
  private latencyMonitor = new LatencyMonitor();
  private tokenAnalytics = new TokenAnalytics();

  evaluate(
    request: CompletionRequest,
    response: CompletionResponse
  ): EvaluationResult {
    const issues: EvaluationIssue[] = [];

    // Quality scoring
    const qualityReport = this.qualityScorer.score(request, response);

    // Hallucination detection
    const hallucinationCheck = this.hallucinationDetector.detect(response.content);
    if (hallucinationCheck.isHallucinated) {
      issues.push({
        type: "hallucination",
        severity: hallucinationCheck.confidence > 0.7 ? "high" : "medium",
        description: `Potential hallucination detected (confidence: ${(hallucinationCheck.confidence * 100).toFixed(1)}%)`,
        suggestion: "Verify claims against authoritative sources",
      });
    }

    // Safety filtering
    const safetyCheck = this.safetyFilter.check(response.content);
    if (!safetyCheck.isSafe) {
      issues.push({
        type: "unsafe_content",
        severity: "high",
        description: `Unsafe content detected in categories: ${Object.entries(safetyCheck.categories)
          .filter(([, v]) => v > 0)
          .map(([k]) => k)
          .join(", ")}`,
        suggestion: "Review and filter content before publishing",
      });
    }

    // Relevance scoring
    const relevanceReport = this.qualityScorer.score(request, response);
    const relevanceMetric = relevanceReport.metrics.find((m) => m.name === "relevance");
    if (relevanceMetric && relevanceMetric.score < 0.4) {
      issues.push({
        type: "irrelevance",
        severity: "medium",
        description: "Response may not be relevant to the query",
        suggestion: "Review the prompt and context provided",
      });
    }

    // Token limit warning
    if (response.usage.completionTokens > (response.usage.promptTokens * 0.5)) {
      issues.push({
        type: "token_limit",
        severity: "low",
        description: "Response is significantly longer than the prompt",
        suggestion: "Consider reducing maxTokens or adding conciseness instructions",
      });
    }

    // Record metrics
    this.costTracker.record({
      provider: response.provider,
      model: response.model,
      inputTokens: response.usage.promptTokens,
      outputTokens: response.usage.completionTokens,
      cost: response.usage.estimatedCost,
      requestId: response.id,
    });

    this.latencyMonitor.record({
      requestId: response.id,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
    });

    this.tokenAnalytics.record({
      requestId: response.id,
      provider: response.provider,
      model: response.model,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
    });

    return {
      qualityScore: qualityReport.overallScore,
      relevanceScore: relevanceMetric?.score ?? 0.5,
      safetyScore: safetyCheck.isSafe ? 1 : 0,
      hallucinationScore: hallucinationCheck.confidence,
      latencyMs: response.latencyMs,
      tokenUsage: response.usage,
      issues,
    };
  }

  getCostTracker(): CostTracker {
    return this.costTracker;
  }

  getLatencyMonitor(): LatencyMonitor {
    return this.latencyMonitor;
  }

  getTokenAnalytics(): TokenAnalytics {
    return this.tokenAnalytics;
  }
}
