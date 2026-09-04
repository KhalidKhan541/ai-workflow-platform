import type {
  PromptTemplate,
  PromptVariable,
  FewShotExample,
  AIMessage,
} from "@/types/ai";

// ─── Template Engine ─────────────────────────────────────────────────────────

export class PromptTemplateEngine {
  private templates: Map<string, PromptTemplate> = new Map();
  private versions: Map<string, PromptTemplate[]> = new Map();

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);

    const existing = this.versions.get(template.id) ?? [];
    existing.push(template);
    this.versions.set(template.id, existing);
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  getVersion(id: string, version: number): PromptTemplate | undefined {
    const versions = this.versions.get(id);
    return versions?.find((v) => v.version === version);
  }

  getLatestVersion(id: string): PromptTemplate | undefined {
    const versions = this.versions.get(id);
    if (!versions || versions.length === 0) return undefined;
    return versions.reduce((latest, v) => (v.version > latest.version ? v : latest));
  }

  render(
    templateId: string,
    variables: Record<string, unknown>,
    options?: { version?: number; includeExamples?: boolean; maxExamples?: number }
  ): { systemPrompt: string; messages: AIMessage[] } {
    const template = options?.version
      ? this.getVersion(templateId, options.version)
      : this.getLatestVersion(templateId);

    if (!template) {
      throw new Error(`Prompt template "${templateId}" not found`);
    }

    this.validateVariables(template, variables);

    const systemPrompt = this.renderTemplate(template.systemPrompt, variables);
    const userPrompt = this.renderTemplate(template.userPromptTemplate, variables);

    const messages: AIMessage[] = [];

    // Inject few-shot examples if requested
    if (options?.includeExamples !== false && template.examples) {
      const maxExamples = options?.maxExamples ?? template.examples.length;
      const selectedExamples = template.examples.slice(0, maxExamples);

      for (const example of selectedExamples) {
        const renderedInput = this.renderTemplate(
          JSON.stringify(example.input),
          variables
        );
        messages.push({
          role: "user",
          content: renderedInput,
        });
        messages.push({
          role: "assistant",
          content: this.renderTemplate(example.output, variables),
        });
      }
    }

    messages.push({
      role: "user",
      content: userPrompt,
    });

    return { systemPrompt, messages };
  }

  renderTemplate(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key in variables) {
        return String(variables[key]);
      }
      return match;
    });
  }

  private validateVariables(
    template: PromptTemplate,
    variables: Record<string, unknown>
  ): void {
    for (const variable of template.variables) {
      if (variable.required && !(variable.name in variables)) {
        if (variable.defaultValue === undefined) {
          throw new Error(
            `Missing required variable "${variable.name}" for template "${template.id}"`
          );
        }
      }
    }
  }
}

// ─── Prompt Composer ─────────────────────────────────────────────────────────

export interface PromptSection {
  type: "system" | "context" | "instructions" | "examples" | "constraints" | "output_format";
  content: string;
  priority: number;
}

export class PromptComposer {
  private sections: PromptSection[] = [];

  addSection(section: PromptSection): this {
    this.sections.push(section);
    return this;
  }

  addSystemPrompt(prompt: string, priority: number = 100): this {
    return this.addSection({ type: "system", content: prompt, priority });
  }

  addContext(context: string, priority: number = 80): this {
    return this.addSection({ type: "context", content: context, priority });
  }

  addInstructions(instructions: string, priority: number = 90): this {
    return this.addSection({ type: "instructions", content: instructions, priority });
  }

  addExamples(examples: string, priority: number = 70): this {
    return this.addSection({ type: "examples", content: examples, priority });
  }

  addConstraints(constraints: string, priority: number = 85): this {
    return this.addSection({ type: "constraints", content: constraints, priority });
  }

  addOutputFormat(format: string, priority: number = 75): this {
    return this.addSection({ type: "output_format", content: format, priority });
  }

  compose(maxTokens?: number): string {
    const sorted = [...this.sections].sort((a, b) => b.priority - a.priority);
    let result = sorted.map((s) => s.content).join("\n\n");

    if (maxTokens) {
      const estimatedTokens = Math.ceil(result.length / 4);
      if (estimatedTokens > maxTokens) {
        const maxChars = maxTokens * 4;
        result = result.slice(0, maxChars - 50) + "\n\n[Truncated to fit token limit]";
      }
    }

    return result;
  }

  clear(): void {
    this.sections = [];
  }
}

// ─── Token Optimizer ─────────────────────────────────────────────────────────

export class PromptOptimizer {
  static compress(text: string, targetTokens: number): string {
    const currentTokens = Math.ceil(text.length / 4);
    if (currentTokens <= targetTokens) return text;

    // Strategy 1: Remove redundant whitespace
    let compressed = text.replace(/\s+/g, " ").trim();

    // Strategy 2: Remove filler words
    const fillerWords = [
      "please", "kindly", "could you", "I would like you to",
      "it is important that", "make sure to", "ensure that",
    ];
    for (const filler of fillerWords) {
      compressed = compressed.replace(new RegExp(filler, "gi"), "");
    }

    // Strategy 3: Truncate if still too long
    const newTokens = Math.ceil(compressed.length / 4);
    if (newTokens > targetTokens) {
      const maxChars = targetTokens * 4;
      compressed = compressed.slice(0, maxChars - 20) + " [...]";
    }

    return compressed;
  }

  static extractKeyInstructions(text: string, maxInstructions: number = 5): string[] {
    const lines = text.split("\n").filter((l) => l.trim());
    const instructions: string[] = [];

    // Look for numbered instructions, bullet points, or imperative sentences
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        /^\d+[.)]\s/.test(trimmed) ||
        /^[-*]\s/.test(trimmed) ||
        /^(always|never|must|should|do|don't)\s/i.test(trimmed)
      ) {
        instructions.push(trimmed);
      }
    }

    return instructions.slice(0, maxInstructions);
  }

  static formatChainOfThought(
    thought: string,
    steps: string[],
    conclusion: string
  ): string {
    let result = `<thinking>\n${thought}\n</thinking>\n\n`;
    result += steps.map((step, i) => `Step ${i + 1}: ${step}`).join("\n\n");
    result += `\n\n<conclusion>\n${conclusion}\n</conclusion>`;
    return result;
  }
}

// ─── Few-Shot Example Manager ────────────────────────────────────────────────

export class FewShotManager {
  private examples: FewShotExample[] = [];

  addExample(example: FewShotExample): void {
    this.examples.push(example);
  }

  addExamples(examples: FewShotExample[]): void {
    this.examples.push(...examples);
  }

  getExamples(count: number = 3): FewShotExample[] {
    return this.examples.slice(0, count);
  }

  getRelevantExamples(
    query: string,
    count: number = 3
  ): FewShotExample[] {
    // Simple relevance: count overlapping words
    const queryWords = new Set(query.toLowerCase().split(/\s+/));

    const scored = this.examples.map((ex) => {
      const inputText = Object.values(ex.input).join(" ").toLowerCase();
      const inputWords = new Set(inputText.split(/\s+/));
      const overlap = Array.from(queryWords).filter((w) => inputWords.has(w)).length;
      return { example: ex, score: overlap };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((s) => s.example);
  }

  formatExamples(examples: FewShotExample[]): string {
    return examples
      .map((ex, i) => {
        const inputStr = Object.entries(ex.input)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        return `Example ${i + 1}:\nInput:\n${inputStr}\nOutput:\n${ex.output}`;
      })
      .join("\n\n---\n\n");
  }

  size(): number {
    return this.examples.length;
  }
}

// ─── System Prompt Builder ───────────────────────────────────────────────────

export interface PersonaConfig {
  name: string;
  role: string;
  expertise: string[];
  style: "formal" | "casual" | "technical" | "concise";
  language: string;
}

export class SystemPromptBuilder {
  private persona: PersonaConfig | null = null;
  private capabilities: string[] = [];
  private limitations: string[] = [];
  private rules: string[] = [];
  private outputFormat: string | null = null;

  setPersona(config: PersonaConfig): this {
    this.persona = config;
    return this;
  }

  addCapability(capability: string): this {
    this.capabilities.push(capability);
    return this;
  }

  addLimitation(limitation: string): this {
    this.limitations.push(limitation);
    return this;
  }

  addRule(rule: string): this {
    this.rules.push(rule);
    return this;
  }

  setOutputFormat(format: string): this {
    this.outputFormat = format;
    return this;
  }

  build(): string {
    const parts: string[] = [];

    if (this.persona) {
      const p = this.persona;
      parts.push(
        `You are ${p.name}, a ${p.role}.\n` +
        `Your areas of expertise include: ${p.expertise.join(", ")}.\n` +
        `Communication style: ${p.style}.\n` +
        `Primary language: ${p.language}.`
      );
    }

    if (this.capabilities.length > 0) {
      parts.push(
        `## Capabilities\n${this.capabilities.map((c) => `- ${c}`).join("\n")}`
      );
    }

    if (this.limitations.length > 0) {
      parts.push(
        `## Limitations\n${this.limitations.map((l) => `- ${l}`).join("\n")}`
      );
    }

    if (this.rules.length > 0) {
      parts.push(
        `## Rules\n${this.rules.map((r) => `- ${r}`).join("\n")}`
      );
    }

    if (this.outputFormat) {
      parts.push(`## Output Format\n${this.outputFormat}`);
    }

    return parts.join("\n\n");
  }
}

// ─── Prompt Version Control ──────────────────────────────────────────────────

export interface PromptVersion {
  version: number;
  template: PromptTemplate;
  createdAt: Date;
  author: string;
  changelog: string;
  metrics?: {
    avgQualityScore?: number;
    avgLatencyMs?: number;
    usageCount?: number;
  };
}

export class PromptVersionControl {
  private history: Map<string, PromptVersion[]> = new Map();
  private activeVersions: Map<string, number> = new Map();

  commit(template: PromptTemplate, author: string, changelog: string): PromptVersion {
    const versions = this.history.get(template.id) ?? [];
    const nextVersion = versions.length + 1;

    const version: PromptVersion = {
      version: nextVersion,
      template: { ...template, version: nextVersion },
      createdAt: new Date(),
      author,
      changelog,
    };

    versions.push(version);
    this.history.set(template.id, versions);
    this.activeVersions.set(template.id, nextVersion);

    return version;
  }

  getActiveVersion(templateId: string): PromptVersion | undefined {
    const activeVersion = this.activeVersions.get(templateId);
    if (!activeVersion) return undefined;
    return this.getVersion(templateId, activeVersion);
  }

  getVersion(templateId: string, version: number): PromptVersion | undefined {
    const versions = this.history.get(templateId);
    return versions?.find((v) => v.version === version);
  }

  getHistory(templateId: string): PromptVersion[] {
    return this.history.get(templateId) ?? [];
  }

  rollback(templateId: string, targetVersion: number): PromptVersion | undefined {
    const version = this.getVersion(templateId, targetVersion);
    if (version) {
      this.activeVersions.set(templateId, targetVersion);
    }
    return version;
  }

  listTemplates(): string[] {
    return Array.from(this.history.keys());
  }

  updateMetrics(
    templateId: string,
    metrics: { avgQualityScore?: number; avgLatencyMs?: number; usageCount?: number }
  ): void {
    const activeVersion = this.getActiveVersion(templateId);
    if (activeVersion) {
      activeVersion.metrics = {
        ...activeVersion.metrics,
        ...metrics,
      };
    }
  }
}

// ─── Predefined Prompts ──────────────────────────────────────────────────────

export const predefinedPrompts = {
  codeReview: {
    system: "You are an expert code reviewer. Analyze code for bugs, security issues, performance problems, and style violations. Be specific and provide actionable suggestions.",
    format: "Provide your review as:\n1. Summary\n2. Issues (severity: critical/high/medium/low)\n3. Suggestions\n4. Overall score (1-10)",
  },
  dataAnalysis: {
    system: "You are a data analyst. Analyze the provided data, identify patterns, trends, and anomalies. Present findings in a clear, structured format with supporting evidence.",
    format: "Present analysis as:\n1. Key Findings\n2. Trends & Patterns\n3. Anomalies\n4. Recommendations",
  },
  contentGeneration: {
    system: "You are a professional content writer. Create engaging, accurate, and well-structured content tailored to the target audience. Maintain consistent tone and style throughout.",
    format: "Structure content with:\n1. Engaging hook/intro\n2. Main body with clear sections\n3. Supporting details/evidence\n4. Call to action or conclusion",
  },
  taskPlanning: {
    system: "You are a project planning expert. Break down tasks into actionable steps, identify dependencies, estimate effort, and suggest optimal sequencing.",
    format: "Present plan as:\n1. Task breakdown\n2. Dependencies\n3. Effort estimates\n4. Recommended sequence",
  },
  customerSupport: {
    system: "You are a helpful customer support agent. Be empathetic, professional, and solution-oriented. Understand the customer's issue and provide clear, actionable solutions.",
    format: "Response should include:\n1. Acknowledgment of the issue\n2. Solution or workaround\n3. Next steps\n4. Follow-up if needed",
  },
};
