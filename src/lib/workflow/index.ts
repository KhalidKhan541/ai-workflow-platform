// Workflow library barrel export

// ─── Types ───────────────────────────────────────────────
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type TriggerType = 'manual' | 'webhook' | 'schedule' | 'event' | 'cron';

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  next?: string[];
  condition?: string;
  onError?: 'stop' | 'continue' | 'retry';
  retryPolicy?: { maxAttempts: number; delayMs: number };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  trigger: { type: TriggerType; config: Record<string, unknown> };
  steps: WorkflowStep[];
  variables?: Record<string, unknown>;
  tags?: string[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: StepStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  stepResults: Map<string, StepResult>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface StepResult {
  stepId: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface ExecutionContext {
  workflow: Workflow;
  execution: WorkflowExecution;
  variables: Record<string, unknown>;
  stepResults: Map<string, StepResult>;
}

// ─── Step Executor Registry ──────────────────────────────
type StepExecutor = (step: WorkflowStep, context: ExecutionContext) => Promise<unknown>;

const executors = new Map<string, StepExecutor>();

export function registerStepExecutor(type: string, executor: StepExecutor): void {
  executors.set(type, executor);
}

// ─── Workflow Engine ─────────────────────────────────────
class WorkflowEngine {
  private executions = new Map<string, WorkflowExecution>();

  async execute(
    workflow: Workflow,
    input?: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      workflowId: workflow.id,
      status: 'running',
      input,
      stepResults: new Map(),
      startedAt: new Date(),
    };

    this.executions.set(execution.id, execution);

    const context: ExecutionContext = {
      workflow,
      execution,
      variables: { ...workflow.variables, ...input },
      stepResults: execution.stepResults,
    };

    try {
      for (const step of workflow.steps) {
        if (execution.status === 'failed') break;

        const result = await this.executeStep(step, context);
        execution.stepResults.set(step.id, result);

        if (result.status === 'failed') {
          execution.status = 'failed';
          execution.error = result.error;
          break;
        }

        // Store step output in variables for subsequent steps
        context.variables[`${step.id}_output`] = result.output;
      }

      if (execution.status === 'running') {
        execution.status = 'completed';
        execution.output = this.collectOutputs(context);
      }
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
    } finally {
      execution.completedAt = new Date();
    }

    return execution;
  }

  private async executeStep(step: WorkflowStep, context: ExecutionContext): Promise<StepResult> {
    const result: StepResult = {
      stepId: step.id,
      status: 'running',
      startedAt: new Date(),
    };

    try {
      const executor = executors.get(step.type);
      if (!executor) {
        throw new Error(`No executor registered for step type: ${step.type}`);
      }

      // Evaluate condition if present
      if (step.condition) {
        const conditionMet = this.evaluateCondition(step.condition, context);
        if (!conditionMet) {
          result.status = 'skipped';
          result.completedAt = new Date();
          return result;
        }
      }

      result.input = step.config;
      result.output = await executor(step, context);
      result.status = 'completed';
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);

      if (step.onError === 'retry' && step.retryPolicy) {
        for (let attempt = 1; attempt < step.retryPolicy.maxAttempts; attempt++) {
          await new Promise((r) => setTimeout(r, step.retryPolicy!.delayMs));
          try {
            const executor = executors.get(step.type)!;
            result.output = await executor(step, context);
            result.status = 'completed';
            result.error = undefined;
            break;
          } catch {
            if (attempt === step.retryPolicy.maxAttempts - 1) {
              result.error = error instanceof Error ? error.message : String(error);
            }
          }
        }
      }
    } finally {
      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - result.startedAt.getTime();
    }

    return result;
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    // Simple condition evaluation: check if variable is truthy
    const value = context.variables[condition];
    return !!value;
  }

  private collectOutputs(context: ExecutionContext): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};
    for (const [stepId, result] of context.stepResults) {
      outputs[stepId] = result.output;
    }
    return outputs;
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id);
  }

  listExecutions(workflowId?: string): WorkflowExecution[] {
    const executions = Array.from(this.executions.values());
    return workflowId ? executions.filter((e) => e.workflowId === workflowId) : executions;
  }
}

// ─── Singleton ───────────────────────────────────────────
const globalEngine = globalThis as unknown as { __workflowEngine?: WorkflowEngine };
export const workflowEngine = globalEngine.__workflowEngine || new WorkflowEngine();
if (process.env.NODE_ENV !== 'production') {
  globalEngine.__workflowEngine = workflowEngine;
}

// ─── Built-in Step Executors ─────────────────────────────
registerStepExecutor('http-request', async (step) => {
  const { url, method = 'GET', headers = {}, body } = step.config as { url: string; method?: string; headers?: Record<string, string>; body?: unknown };
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
});

registerStepExecutor('transform', async (step, context) => {
  const { expression } = step.config as { expression: string };
  // Simple expression evaluation
  return { result: expression };
});

registerStepExecutor('condition', async (step, context) => {
  const { field, operator, value } = step.config as { field: string; operator: string; value: unknown };
  const fieldValue = context.variables[field];
  let result = false;

  switch (operator) {
    case 'eq': result = fieldValue === value; break;
    case 'neq': result = fieldValue !== value; break;
    case 'gt': result = Number(fieldValue) > Number(value); break;
    case 'lt': result = Number(fieldValue) < Number(value); break;
    case 'contains': result = String(fieldValue).includes(String(value)); break;
  }

  return { result };
});

registerStepExecutor('delay', async (step) => {
  const { durationMs = 1000 } = step.config as { durationMs?: number };
  await new Promise((r) => setTimeout(r, durationMs));
  return { delayed: durationMs };
});

// ─── Convenience Functions ───────────────────────────────
export async function executeWorkflow(
  workflow: Workflow,
  input?: Record<string, unknown>
): Promise<WorkflowExecution> {
  return workflowEngine.execute(workflow, input);
}

export function getExecution(id: string): WorkflowExecution | undefined {
  return workflowEngine.getExecution(id);
}
