export interface WorkflowStep {
  id: string;
  type: 'action' | 'condition' | 'delay' | 'loop' | 'parallel' | 'ai';
  name: string;
  config: Record<string, unknown>;
  next?: string;
  onError?: 'stop' | 'continue' | 'retry';
  retryCount?: number;
  timeout?: number;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  trigger?: { type: string; config: Record<string, unknown> };
}

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  variables: Record<string, unknown>;
  stepResults: Map<string, StepResult>;
  startedAt: Date;
  logs: LogEntry[];
}

export interface StepResult {
  stepId: string;
  status: 'success' | 'failed' | 'skipped' | 'timeout';
  output?: unknown;
  error?: string;
  durationMs: number;
  retries: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stepId?: string;
  timestamp: Date;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'failed' | 'timeout' | 'cancelled';
  output?: unknown;
  steps: StepResult[];
  totalDurationMs: number;
  logs: LogEntry[];
}

type StepHandler = (
  step: WorkflowStep,
  context: ExecutionContext,
) => Promise<unknown>;

export class WorkflowEngine {
  private handlers: Map<string, StepHandler> = new Map();
  private defaultTimeout = 30000;

  registerHandler(type: string, handler: StepHandler): void {
    this.handlers.set(type, handler);
  }

  async execute(
    workflow: WorkflowDefinition,
    input: Record<string, unknown> = {},
    options: { dryRun?: boolean; maxDurationMs?: number } = {},
  ): Promise<ExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const context: ExecutionContext = {
      workflowId: workflow.id,
      executionId,
      variables: { ...workflow.variables, ...input },
      stepResults: new Map(),
      startedAt: new Date(),
      logs: [],
    };

    if (options.dryRun) {
      return {
        executionId,
        workflowId: workflow.id,
        status: 'success',
        steps: [],
        totalDurationMs: 0,
        logs: [{ level: 'info', message: 'Dry run - no steps executed', timestamp: new Date() }],
      };
    }

    const maxDuration = options.maxDurationMs ?? Infinity;
    const stepsResults: StepResult[] = [];
    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));

    let currentStepId = workflow.steps[0]?.id;
    let lastOutput: unknown = undefined;

    while (currentStepId) {
      const elapsed = Date.now() - context.startedAt.getTime();
      if (elapsed > maxDuration) {
        stepsResults.push({
          stepId: currentStepId,
          status: 'timeout',
          error: 'Workflow exceeded maximum duration',
          durationMs: 0,
          retries: 0,
        });
        return {
          executionId,
          workflowId: workflow.id,
          status: 'timeout',
          steps: stepsResults,
          totalDurationMs: elapsed,
          logs: context.logs,
        };
      }

      const step = stepMap.get(currentStepId);
      if (!step) {
        context.logs.push({ level: 'error', message: `Step '${currentStepId}' not found`, timestamp: new Date() });
        break;
      }

      const result = await this.executeStep(step, context, lastOutput);
      stepsResults.push(result);
      context.stepResults.set(step.id, result);

      if (result.status === 'failed' && step.onError !== 'continue') {
        return {
          executionId,
          workflowId: workflow.id,
          status: 'failed',
          output: result.error,
          steps: stepsResults,
          totalDurationMs: Date.now() - context.startedAt.getTime(),
          logs: context.logs,
        };
      }

      lastOutput = result.output;
      currentStepId = step.next;
    }

    return {
      executionId,
      workflowId: workflow.id,
      status: 'success',
      output: lastOutput,
      steps: stepsResults,
      totalDurationMs: Date.now() - context.startedAt.getTime(),
      logs: context.logs,
    };
  }

  async executeStep(
    step: WorkflowStep,
    context: ExecutionContext,
    previousOutput?: unknown,
  ): Promise<StepResult> {
    const startTime = Date.now();
    let retries = 0;
    const maxRetries = step.retryCount ?? 0;
    const timeout = step.timeout ?? this.defaultTimeout;

    const interpolatedConfig = this.interpolate(step.config, context.variables, previousOutput);

    while (retries <= maxRetries) {
      try {
        const handler = this.handlers.get(step.type);
        if (!handler) {
          throw new Error(`No handler registered for step type '${step.type}'`);
        }

        const output = await Promise.race([
          handler({ ...step, config: interpolatedConfig }, context),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Step '${step.id}' timed out after ${timeout}ms`)), timeout),
          ),
        ]);

        context.logs.push({
          level: 'info',
          message: `Step '${step.name}' completed successfully`,
          stepId: step.id,
          timestamp: new Date(),
        });

        return {
          stepId: step.id,
          status: 'success',
          output,
          durationMs: Date.now() - startTime,
          retries,
        };
      } catch (error) {
        retries++;
        const errMsg = error instanceof Error ? error.message : String(error);
        context.logs.push({
          level: retries > maxRetries ? 'error' : 'warn',
          message: `Step '${step.name}' failed: ${errMsg}${retries <= maxRetries ? ` (retry ${retries}/${maxRetries})` : ''}`,
          stepId: step.id,
          timestamp: new Date(),
        });
      }
    }

    return {
      stepId: step.id,
      status: 'failed',
      error: `Step failed after ${retries} retries`,
      durationMs: Date.now() - startTime,
      retries: retries - 1,
    };
  }

  interpolate(
    config: Record<string, unknown>,
    variables: Record<string, unknown>,
    previousOutput?: unknown,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
          const parts = path.split('.');
          if (parts[0] === 'output' && previousOutput !== undefined) {
            let obj: any = previousOutput;
            for (const part of parts.slice(1)) {
              obj = obj?.[part];
            }
            return obj !== undefined ? String(obj) : match;
          }
          let obj: any = variables;
          for (const part of parts) {
            obj = obj?.[part];
          }
          return obj !== undefined ? String(obj) : match;
        });
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.interpolate(value as Record<string, unknown>, variables, previousOutput);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
