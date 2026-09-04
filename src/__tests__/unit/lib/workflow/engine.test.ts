import { WorkflowEngine, WorkflowDefinition, StepHandler } from '@/lib/workflow/engine';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  const mockHandler: StepHandler = jest.fn().mockImplementation(async (step) => {
    return { success: true, type: step.type };
  });

  describe('execute - linear workflow', () => {
    it('should execute a simple linear workflow with one step', async () => {
      engine.registerHandler('action', mockHandler);
      const workflow: WorkflowDefinition = {
        id: 'wf-1',
        name: 'Simple Workflow',
        steps: [
          { id: 'step-1', type: 'action', name: 'Step 1', config: { url: 'http://api.test' }, next: undefined },
        ],
      };

      const result = await engine.execute(workflow);

      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe('success');
      expect(result.steps[0].stepId).toBe('step-1');
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple steps in sequence', async () => {
      engine.registerHandler('action', mockHandler);
      const workflow: WorkflowDefinition = {
        id: 'wf-2',
        name: 'Multi-step',
        steps: [
          { id: 'step-1', type: 'action', name: 'Step 1', config: {}, next: 'step-2' },
          { id: 'step-2', type: 'action', name: 'Step 2', config: {}, next: 'step-3' },
          { id: 'step-3', type: 'action', name: 'Step 3', config: {} },
        ],
      };

      const result = await engine.execute(workflow);

      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(3);
      expect(result.steps[0].stepId).toBe('step-1');
      expect(result.steps[1].stepId).toBe('step-2');
      expect(result.steps[2].stepId).toBe('step-3');
      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should pass output from one step to the next', async () => {
      const handler1 = jest.fn().mockResolvedValue({ value: 42 });
      const handler2 = jest.fn().mockImplementation(async (_step, _ctx) => ({ doubled: 84 }));

      engine.registerHandler('action', handler1);
      engine.registerHandler('condition', handler2);

      const workflow: WorkflowDefinition = {
        id: 'wf-pass',
        name: 'Pass Output',
        steps: [
          { id: 's1', type: 'action', name: 'Produce', config: {}, next: 's2' },
          { id: 's2', type: 'condition', name: 'Consume', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('success');
    });
  });

  describe('execute - branching workflow', () => {
    it('should handle branching via next field', async () => {
      engine.registerHandler('action', mockHandler);
      const workflow: WorkflowDefinition = {
        id: 'wf-branch',
        name: 'Branching',
        steps: [
          { id: 's1', type: 'action', name: 'Start', config: {}, next: 's2a' },
          { id: 's2a', type: 'action', name: 'Branch A', config: {} },
          { id: 's2b', type: 'action', name: 'Branch B (unreachable)', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.steps).toHaveLength(2);
      expect(result.steps.map((s) => s.stepId)).toEqual(['s1', 's2a']);
    });
  });

  describe('step failure and retry', () => {
    it('should stop on failure by default', async () => {
      const failHandler = jest.fn().mockRejectedValue(new Error('Boom'));
      engine.registerHandler('action', failHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-fail',
        name: 'Failing',
        steps: [
          { id: 's1', type: 'action', name: 'Fail', config: {} },
          { id: 's2', type: 'action', name: 'Never', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('failed');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].status).toBe('failed');
    });

    it('should retry failed steps up to retryCount', async () => {
      let callCount = 0;
      const flakyHandler = jest.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) throw new Error(`Attempt ${callCount} failed`);
        return { recovered: true };
      });
      engine.registerHandler('action', flakyHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-retry',
        name: 'Retry',
        steps: [
          { id: 's1', type: 'action', name: 'Flaky', config: {}, retryCount: 3 },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('success');
      expect(result.steps[0].retries).toBe(2);
      expect(flakyHandler).toHaveBeenCalledTimes(3);
    });

    it('should continue on error when onError is continue', async () => {
      const failHandler = jest.fn().mockRejectedValue(new Error('Fail'));
      const okHandler = jest.fn().mockResolvedValue({ ok: true });
      engine.registerHandler('action', failHandler);
      engine.registerHandler('condition', okHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-continue',
        name: 'Continue',
        steps: [
          { id: 's1', type: 'action', name: 'Fail', config: {}, onError: 'continue', next: 's2' },
          { id: 's2', type: 'condition', name: 'OK', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].status).toBe('failed');
      expect(result.steps[1].status).toBe('success');
    });

    it('should fail after exhausting retries', async () => {
      const failHandler = jest.fn().mockRejectedValue(new Error('Always fail'));
      engine.registerHandler('action', failHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-exhaust',
        name: 'Exhaust',
        steps: [
          { id: 's1', type: 'action', name: 'Always Fail', config: {}, retryCount: 2 },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('failed');
      expect(failHandler).toHaveBeenCalledTimes(3);
    });
  });

  describe('timeout handling', () => {
    it('should timeout a step that exceeds timeout', async () => {
      const slowHandler = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );
      engine.registerHandler('action', slowHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-timeout',
        name: 'Timeout',
        steps: [
          { id: 's1', type: 'action', name: 'Slow', config: {}, timeout: 100 },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('failed');
      expect(result.steps[0].status).toBe('failed');
    });
  });

  describe('variable interpolation', () => {
    it('should interpolate variables in step config', async () => {
      engine.registerHandler('action', mockHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-interp',
        name: 'Interpolate',
        variables: { apiUrl: 'http://test.com', version: '2' },
        steps: [
          { id: 's1', type: 'action', name: 'Call', config: { url: '{{apiUrl}}/v{{version}}/data' } },
        ],
      };

      await engine.execute(workflow);

      const calledConfig = mockHandler.mock.calls[0][0].config;
      expect(calledConfig.url).toBe('http://test.com/v2/data');
    });

    it('should interpolate nested objects', async () => {
      engine.registerHandler('action', mockHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-nested',
        name: 'Nested',
        variables: { host: 'api.test.com' },
        steps: [
          { id: 's1', type: 'action', name: 'Call', config: { headers: { host: '{{host}}' } } },
        ],
      };

      await engine.execute(workflow);
      const calledConfig = mockHandler.mock.calls[0][0].config;
      expect(calledConfig.headers.host).toBe('api.test.com');
    });
  });

  describe('loop execution', () => {
    it('should execute a loop step', async () => {
      const loopHandler = jest.fn().mockResolvedValue({ iterated: true });
      engine.registerHandler('loop', loopHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-loop',
        name: 'Loop',
        steps: [
          { id: 's1', type: 'loop', name: 'Loop', config: { count: 3 } },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('success');
      expect(loopHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('parallel step execution', () => {
    it('should execute a parallel step', async () => {
      const parallelHandler = jest.fn().mockResolvedValue({ parallel: true });
      engine.registerHandler('parallel', parallelHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-parallel',
        name: 'Parallel',
        steps: [
          { id: 's1', type: 'parallel', name: 'Parallel', config: { branches: ['a', 'b', 'c'] } },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('success');
    });
  });

  describe('dry run', () => {
    it('should skip execution in dry run mode', async () => {
      engine.registerHandler('action', mockHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-dry',
        name: 'Dry',
        steps: [
          { id: 's1', type: 'action', name: 'Skip', config: {} },
        ],
      };

      const result = await engine.execute(workflow, {}, { dryRun: true });
      expect(result.status).toBe('success');
      expect(result.steps).toHaveLength(0);
      expect(result.logs[0].message).toContain('Dry run');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('max duration', () => {
    it('should timeout workflow when maxDurationMs exceeded', async () => {
      const slowHandler = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 200)),
      );
      engine.registerHandler('action', slowHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-maxdur',
        name: 'MaxDur',
        steps: [
          { id: 's1', type: 'action', name: 'Slow', config: {} },
          { id: 's2', type: 'action', name: 'More', config: {} },
        ],
      };

      const result = await engine.execute(workflow, {}, { maxDurationMs: 50 });
      expect(result.status).toBe('timeout');
    });
  });

  describe('interpolate utility', () => {
    it('should return non-string values unchanged', () => {
      const result = engine.interpolate({ num: 42, arr: [1, 2] }, {});
      expect(result.num).toBe(42);
      expect(result.arr).toEqual([1, 2]);
    });

    it('should handle missing variables gracefully', () => {
      const result = engine.interpolate({ key: '{{missing}}' }, {});
      expect(result.key).toBe('{{missing}}');
    });
  });

  describe('error handling', () => {
    it('should handle unregistered step type', async () => {
      const workflow: WorkflowDefinition = {
        id: 'wf-unknown',
        name: 'Unknown',
        steps: [
          { id: 's1', type: 'unknown_type' as any, name: 'Unknown', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      expect(result.status).toBe('failed');
    });
  });

  describe('logging', () => {
    it('should log step completions', async () => {
      engine.registerHandler('action', mockHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-log',
        name: 'Log',
        steps: [
          { id: 's1', type: 'action', name: 'Logged Step', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      const logMessages = result.logs.map((l) => l.message);
      expect(logMessages.some((m) => m.includes('completed successfully'))).toBe(true);
    });

    it('should log step failures', async () => {
      const failHandler = jest.fn().mockRejectedValue(new Error('Test error'));
      engine.registerHandler('action', failHandler);

      const workflow: WorkflowDefinition = {
        id: 'wf-log-fail',
        name: 'Log Fail',
        steps: [
          { id: 's1', type: 'action', name: 'Fail Step', config: {} },
        ],
      };

      const result = await engine.execute(workflow);
      const logMessages = result.logs.map((l) => l.message);
      expect(logMessages.some((m) => m.includes('failed'))).toBe(true);
    });
  });
});
