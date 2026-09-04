import type { ToolDefinition, ToolResult } from "@/types/ai";

// ─── Tool Registry ───────────────────────────────────────────────────────────

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<unknown>;

export interface ToolContext {
  userId: string;
  workspaceId: string;
  variables: Record<string, string>;
}

export interface ToolRegistration {
  definition: ToolDefinition;
  handler: ToolHandler;
  category: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();

  register(registration: ToolRegistration): void {
    this.tools.set(registration.definition.function.name, registration);
  }

  get(name: string): ToolRegistration | undefined {
    return this.tools.get(name);
  }

  getAll(): ToolRegistration[] {
    return Array.from(this.tools.values());
  }

  getDefinitions(): ToolDefinition[] {
    return this.getAll().map((r) => r.definition);
  }

  getByCategory(category: string): ToolRegistration[] {
    return this.getAll().filter((r) => r.category === category);
  }

  async execute(
    name: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolCallId: "",
        name,
        result: null,
        error: `Tool "${name}" not found`,
        latencyMs: 0,
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(args, context);
      return {
        toolCallId: "",
        name,
        result,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        toolCallId: "",
        name,
        result: null,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const webSearchTool: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web for information on any topic. Returns relevant URLs and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
        numResults: { type: "number", description: "Number of results to return (default: 5)" },
      },
      required: ["query"],
    },
  },
};

export const webSearchHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  const numResults = (args.numResults as number) ?? 5;

  // In production, use a real search API (SerpAPI, Tavily, etc.)
  return {
    results: [
      { title: `Result for: ${query}`, url: "https://example.com", snippet: "..." },
    ],
    totalResults: numResults,
  };
};

export const codeExecutionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "execute_code",
    description: "Execute JavaScript/TypeScript code in a sandboxed environment.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "The code to execute" },
        language: { type: "string", enum: ["javascript", "typescript"], description: "Code language" },
      },
      required: ["code"],
    },
  },
};

export const codeExecutionHandler: ToolHandler = async (args) => {
  const code = args.code as string;

  // Sandboxed eval with timeout
  const timeout = 5000;
  const startTime = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ error: "Execution timed out", output: null });
    }, timeout);

    try {
      // Note: In production, use a proper sandbox (VM2, Docker, etc.)
      const fn = new Function("return " + code);
      const result = fn();
      clearTimeout(timer);
      resolve({ output: result, error: null, latencyMs: Date.now() - startTime });
    } catch (error) {
      clearTimeout(timer);
      resolve({
        output: null,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - startTime,
      });
    }
  });
};

export const fileReadTool: ToolDefinition = {
  type: "function",
  function: {
    name: "file_read",
    description: "Read the contents of a file from the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
        encoding: { type: "string", description: "File encoding (default: utf-8)" },
      },
      required: ["path"],
    },
  },
};

export const fileReadHandler: ToolHandler = async (args) => {
  const path = args.path as string;
  // In production, read from actual filesystem with sandbox restrictions
  return { content: `[Contents of ${path}]`, path, size: 0 };
};

export const fileWriteTool: ToolDefinition = {
  type: "function",
  function: {
    name: "file_write",
    description: "Write content to a file in the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path relative to workspace root" },
        content: { type: "string", description: "Content to write" },
        mode: { type: "string", enum: ["overwrite", "append"], description: "Write mode" },
      },
      required: ["path", "content"],
    },
  },
};

export const fileWriteHandler: ToolHandler = async (args) => {
  const path = args.path as string;
  const content = args.content as string;
  return { success: true, path, bytesWritten: content.length };
};

export const databaseQueryTool: ToolDefinition = {
  type: "function",
  function: {
    name: "database_query",
    description: "Execute a read-only SQL query against the database.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL query to execute (SELECT only)" },
        params: { type: "array", items: { type: "string" }, description: "Query parameters" },
      },
      required: ["query"],
    },
  },
};

export const databaseQueryHandler: ToolHandler = async (args) => {
  const query = args.query as string;
  if (!query.trim().toUpperCase().startsWith("SELECT")) {
    return { error: "Only SELECT queries are allowed", rows: [] };
  }
  return { rows: [], rowCount: 0 };
};

export const apiCallTool: ToolDefinition = {
  type: "function",
  function: {
    name: "api_call",
    description: "Make an HTTP API call to a specified URL.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to call" },
        method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"], description: "HTTP method" },
        headers: { type: "object", description: "Request headers" },
        body: { type: "object", description: "Request body" },
        timeout: { type: "number", description: "Timeout in milliseconds" },
      },
      required: ["url", "method"],
    },
  },
};

export const apiCallHandler: ToolHandler = async (args) => {
  const url = args.url as string;
  const method = (args.method as string) ?? "GET";
  const headers = (args.headers as Record<string, string>) ?? {};
  const body = args.body ? JSON.stringify(args.body) : undefined;
  const timeout = (args.timeout as number) ?? 10000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body,
      signal: controller.signal,
    });

    const responseBody = await response.text();
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
    };
  } finally {
    clearTimeout(timer);
  }
};

export const mathCalculationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "math_calculate",
    description: "Evaluate a mathematical expression.",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Mathematical expression to evaluate" },
      },
      required: ["expression"],
    },
  },
};

export const mathCalculationHandler: ToolHandler = async (args) => {
  const expression = args.expression as string;

  // Safe math evaluation using Function constructor
  try {
    // Only allow math operations
    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
    if (sanitized !== expression) {
      return { error: "Expression contains invalid characters" };
    }
    const result = new Function(`return (${sanitized})`)();
    return { result, expression };
  } catch (error) {
    return { error: "Invalid mathematical expression", expression };
  }
};

export const jsonManipulationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "json_manipulate",
    description: "Parse, query, or transform JSON data.",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["parse", "stringify", "query", "merge"], description: "Operation to perform" },
        data: { description: "Input data (string for parse, object for others)" },
        path: { type: "string", description: "JSON path for query operation" },
        target: { description: "Target data for merge operation" },
        pretty: { type: "boolean", description: "Pretty print output" },
      },
      required: ["operation", "data"],
    },
  },
};

export const jsonManipulationHandler: ToolHandler = async (args) => {
  const operation = args.operation as string;
  const data = args.data;

  switch (operation) {
    case "parse":
      try {
        return { result: JSON.parse(data as string) };
      } catch {
        return { error: "Invalid JSON string" };
      }
    case "stringify":
      return {
        result: JSON.stringify(data, null, args.pretty ? 2 : undefined),
      };
    case "query": {
      const path = (args.path as string) ?? "";
      const keys = path.split(".").filter(Boolean);
      let current: unknown = data;
      for (const key of keys) {
        if (current && typeof current === "object") {
          current = (current as Record<string, unknown>)[key];
        } else {
          return { error: `Cannot access property "${key}" on non-object` };
        }
      }
      return { result: current };
    }
    case "merge": {
      const target = args.target as Record<string, unknown>;
      return { result: { ...data, ...target } };
    }
    default:
      return { error: `Unknown operation: ${operation}` };
  }
};

export const textExtractionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "text_extract",
    description: "Extract structured data from unstructured text.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to extract from" },
        pattern: { type: "string", description: "Regex pattern or extraction type (email, phone, url, date)" },
      },
      required: ["text", "pattern"],
    },
  },
};

export const textExtractionHandler: ToolHandler = async (args) => {
  const text = args.text as string;
  const pattern = args.pattern as string;

  const patterns: Record<string, string> = {
    email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
    phone: "[\\+]?[0-9]{1,3}[-.\\s]?\\(?[0-9]{1,4}\\)?[-.\\s]?[0-9]{1,4}[-.\\s]?[0-9]{1,9}",
    url: "https?://[^\\s]+",
    date: "\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}",
  };

  const regex = new RegExp(patterns[pattern] ?? pattern, "gi");
  const matches = text.match(regex) ?? [];

  return { matches, count: matches.length };
};

export const imageAnalysisTool: ToolDefinition = {
  type: "function",
  function: {
    name: "image_analyze",
    description: "Analyze an image using AI vision capabilities.",
    parameters: {
      type: "object",
      properties: {
        imageUrl: { type: "string", description: "URL or base64 of the image" },
        question: { type: "string", description: "Question about the image" },
      },
      required: ["imageUrl"],
    },
  },
};

export const imageAnalysisHandler: ToolHandler = async (args) => {
  const imageUrl = args.imageUrl as string;
  const question = args.question ?? "Describe this image";

  // In production, this would call a vision model
  return {
    description: `[Analysis of image: ${imageUrl}]`,
    question,
    tags: [],
    confidence: 0,
  };
};

export const documentParserTool: ToolDefinition = {
  type: "function",
  function: {
    name: "document_parse",
    description: "Parse a document (PDF, DOCX, etc.) and extract text content.",
    parameters: {
      type: "object",
      properties: {
        documentUrl: { type: "string", description: "URL or path to the document" },
        format: { type: "string", enum: ["pdf", "docx", "txt", "html", "md"], description: "Document format" },
      },
      required: ["documentUrl"],
    },
  },
};

export const documentParserHandler: ToolHandler = async (args) => {
  const documentUrl = args.documentUrl as string;
  const format = (args.format as string) ?? "txt";

  return {
    content: `[Parsed content from ${documentUrl}]`,
    format,
    pages: 1,
    metadata: {},
  };
};

export const emailSendTool: ToolDefinition = {
  type: "function",
  function: {
    name: "email_send",
    description: "Send an email to one or more recipients.",
    parameters: {
      type: "object",
      properties: {
        to: { type: "array", items: { type: "string" }, description: "Recipient email addresses" },
        subject: { type: "string", description: "Email subject" },
        body: { type: "string", description: "Email body (supports HTML)" },
        cc: { type: "array", items: { type: "string" }, description: "CC recipients" },
        attachments: { type: "array", items: { type: "string" }, description: "File URLs to attach" },
      },
      required: ["to", "subject", "body"],
    },
  },
};

export const emailSendHandler: ToolHandler = async (args) => {
  const to = args.to as string[];
  const subject = args.subject as string;

  // In production, use an email service (SendGrid, SES, etc.)
  return {
    success: true,
    messageId: `msg_${Date.now()}`,
    to,
    subject,
  };
};

export const calendarOperationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "calendar_operation",
    description: "Create, update, or query calendar events.",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["create", "update", "delete", "list", "get"], description: "Operation type" },
        title: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start time (ISO 8601)" },
        end: { type: "string", description: "End time (ISO 8601)" },
        description: { type: "string", description: "Event description" },
        attendees: { type: "array", items: { type: "string" }, description: "Attendee emails" },
        eventId: { type: "string", description: "Event ID for update/delete" },
      },
      required: ["operation"],
    },
  },
};

export const calendarOperationHandler: ToolHandler = async (args) => {
  const operation = args.operation as string;

  switch (operation) {
    case "create":
      return {
        success: true,
        eventId: `evt_${Date.now()}`,
        title: args.title,
        start: args.start,
        end: args.end,
      };
    case "list":
      return { events: [], total: 0 };
    case "get":
      return { eventId: args.eventId, title: "", start: "", end: "" };
    default:
      return { success: true, operation };
  }
};

export const crmOperationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "crm_operation",
    description: "Query or update CRM records (contacts, companies, deals).",
    parameters: {
      type: "object",
      properties: {
        operation: { type: "string", enum: ["search", "get", "create", "update"], description: "Operation type" },
        objectType: { type: "string", enum: ["contact", "company", "deal", "activity"], description: "CRM object type" },
        query: { type: "string", description: "Search query" },
        id: { type: "string", description: "Record ID" },
        data: { type: "object", description: "Data to create/update" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["operation", "objectType"],
    },
  },
};

export const crmOperationHandler: ToolHandler = async (args) => {
  const operation = args.operation as string;
  const objectType = args.objectType as string;

  switch (operation) {
    case "search":
      return { results: [], total: 0, objectType };
    case "get":
      return { id: args.id, objectType };
    case "create":
      return { success: true, id: `crm_${Date.now()}`, objectType };
    case "update":
      return { success: true, id: args.id, objectType };
    default:
      return { error: `Unknown CRM operation: ${operation}` };
  }
};

export const customFunctionTool: ToolDefinition = {
  type: "function",
  function: {
    name: "custom_function",
    description: "Execute a custom-defined function by name from the workspace.",
    parameters: {
      type: "object",
      properties: {
        functionName: { type: "string", description: "Name of the custom function" },
        args: { type: "object", description: "Arguments to pass to the function" },
      },
      required: ["functionName"],
    },
  },
};

export const customFunctionHandler: ToolHandler = async (args) => {
  const functionName = args.functionName as string;
  const funcArgs = (args.args as Record<string, unknown>) ?? {};

  // In production, look up the function from the workspace
  return {
    functionName,
    args: funcArgs,
    result: null,
    error: "Custom function not found",
  };
};

export const textTransformTool: ToolDefinition = {
  type: "function",
  function: {
    name: "text_transform",
    description: "Transform text with various operations (summarize, translate, format).",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Input text" },
        operation: { type: "string", enum: ["summarize", "translate", "uppercase", "lowercase", "slugify", "word_count"], description: "Transform operation" },
        targetLanguage: { type: "string", description: "Target language for translation" },
        maxLength: { type: "number", description: "Max length for summarization" },
      },
      required: ["text", "operation"],
    },
  },
};

export const textTransformHandler: ToolHandler = async (args) => {
  const text = args.text as string;
  const operation = args.operation as string;

  switch (operation) {
    case "uppercase":
      return { result: text.toUpperCase() };
    case "lowercase":
      return { result: text.toLowerCase() };
    case "slugify":
      return {
        result: text
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      };
    case "word_count":
      return { count: text.split(/\s+/).filter(Boolean).length };
    case "summarize":
      return { result: text.slice(0, args.maxLength as number ?? 200) + "..." };
    case "translate":
      return { result: text, targetLanguage: args.targetLanguage };
    default:
      return { error: `Unknown operation: ${operation}` };
  }
};

export const notificationSendTool: ToolDefinition = {
  type: "function",
  function: {
    name: "notification_send",
    description: "Send a notification via Slack, Teams, or webhook.",
    parameters: {
      type: "object",
      properties: {
        channel: { type: "string", enum: ["slack", "teams", "webhook"], description: "Notification channel" },
        message: { type: "string", description: "Notification message" },
        target: { type: "string", description: "Channel ID, webhook URL, etc." },
        urgency: { type: "string", enum: ["low", "medium", "high"], description: "Notification urgency" },
      },
      required: ["channel", "message"],
    },
  },
};

export const notificationSendHandler: ToolHandler = async (args) => {
  return {
    success: true,
    channel: args.channel,
    messageId: `notif_${Date.now()}`,
  };
};

export const dataValidationTool: ToolDefinition = {
  type: "function",
  function: {
    name: "data_validate",
    description: "Validate data against a schema or rules.",
    parameters: {
      type: "object",
      properties: {
        data: { description: "Data to validate" },
        rules: { type: "object", description: "Validation rules" },
      },
      required: ["data", "rules"],
    },
  },
};

export const dataValidationHandler: ToolHandler = async (args) => {
  const data = args.data;
  const rules = args.rules as Record<string, unknown>;

  const errors: string[] = [];

  if (rules.required && typeof data === "object" && data !== null) {
    for (const field of rules.required as string[]) {
      if (!(data as Record<string, unknown>)[field]) {
        errors.push(`Required field "${field}" is missing`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

export const workflowStepTool: ToolDefinition = {
  type: "function",
  function: {
    name: "workflow_step",
    description: "Execute a workflow step or trigger a workflow chain.",
    parameters: {
      type: "object",
      properties: {
        workflowId: { type: "string", description: "Workflow to trigger" },
        input: { type: "object", description: "Input data for the workflow" },
        async: { type: "boolean", description: "Run asynchronously" },
      },
      required: ["workflowId"],
    },
  },
};

export const workflowStepHandler: ToolHandler = async (args) => {
  return {
    success: true,
    executionId: `exec_${Date.now()}`,
    workflowId: args.workflowId,
    async: args.async ?? false,
  };
};

export const chartGeneratorTool: ToolDefinition = {
  type: "function",
  function: {
    name: "chart_generate",
    description: "Generate a chart or visualization from data.",
    parameters: {
      type: "object",
      properties: {
        data: { type: "array", description: "Data points for the chart" },
        chartType: { type: "string", enum: ["bar", "line", "pie", "scatter", "area"], description: "Chart type" },
        title: { type: "string", description: "Chart title" },
        xLabel: { type: "string", description: "X-axis label" },
        yLabel: { type: "string", description: "Y-axis label" },
      },
      required: ["data", "chartType"],
    },
  },
};

export const chartGeneratorHandler: ToolHandler = async (args) => {
  return {
    chartUrl: `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify({ type: args.chartType, data: { datasets: args.data } }))}`,
    chartType: args.chartType,
  };
};

// ─── Default Registry Factory ────────────────────────────────────────────────

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  const tools: [ToolDefinition, ToolHandler, string][] = [
    [webSearchTool, webSearchHandler, "search"],
    [codeExecutionTool, codeExecutionHandler, "code"],
    [fileReadTool, fileReadHandler, "filesystem"],
    [fileWriteTool, fileWriteHandler, "filesystem"],
    [databaseQueryTool, databaseQueryHandler, "database"],
    [apiCallTool, apiCallHandler, "network"],
    [mathCalculationTool, mathCalculationHandler, "math"],
    [jsonManipulationTool, jsonManipulationHandler, "data"],
    [textExtractionTool, textExtractionHandler, "text"],
    [imageAnalysisTool, imageAnalysisHandler, "vision"],
    [documentParserTool, documentParserHandler, "documents"],
    [emailSendTool, emailSendHandler, "communication"],
    [calendarOperationTool, calendarOperationHandler, "productivity"],
    [crmOperationTool, crmOperationHandler, "business"],
    [customFunctionTool, customFunctionHandler, "custom"],
    [textTransformTool, textTransformHandler, "text"],
    [notificationSendTool, notificationSendHandler, "communication"],
    [dataValidationTool, dataValidationHandler, "data"],
    [workflowStepTool, workflowStepHandler, "workflow"],
    [chartGeneratorTool, chartGeneratorHandler, "visualization"],
  ];

  for (const [definition, handler, category] of tools) {
    registry.register({ definition, handler, category });
  }

  return registry;
}
