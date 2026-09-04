/**
 * Workflow Execution Orchestrator
 * 
 * Manages workflow execution with BullMQ queue, worker processes,
 * concurrency control, progress tracking, and result aggregation.
 * 
 * @module workflow/executor
 */

import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { WorkflowEngine, WorkflowDefinition, ExecutionResult, ExecutionOptions } from './engine';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ExecutorStatus = 'idle' | 'processing' | 'paused' | 'shutting-down';

export interface ExecutorConfig {
  /** Maximum concurrent workflow executions */
  concurrency: number;
  /** Maximum jobs per worker */
  jobsPerWorker: number;
  /** Queue name prefix */
  queuePrefix: string;
  /** Redis connection options */
  redis: RedisConfig;
  /** Job timeout in milliseconds */
  jobTimeout: number;
  /** Maximum retry attempts for failed jobs */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Cleanup interval for completed jobs in milliseconds */
  cleanupInterval: number;
  /** Maximum age for completed jobs in milliseconds */
  maxJobAge: number;
  /** Enable progress tracking */
  enableProgress: boolean;
  /** Enable metrics collection */
  enableMetrics: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
}

export interface ExecutionRequest {
  id: string;
  workflowId: string;
  workflow: WorkflowDefinition;
  inputs: Record<string, unknown>;
  options: ExecutionOptions;
  priority: JobPriority;
  metadata: ExecutionMetadata;
  createdAt: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ExecutionMetadata {
  userId?: string;
  organizationId?: string;
  source: 'api' | 'trigger' | 'scheduler' | 'manual';
  correlationId?: string;
  tags?: string[];
}

export interface ExecutionProgress {
  executionId: string;
  workflowId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  currentStep?: string;
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
  startTime?: Date;
  estimatedCompletion?: Date;
  error?: string;
}

export interface WorkerStats {
  workerId: string;
  status: 'idle' | 'busy' | 'stopped';
  currentJob?: string;
  jobsProcessed: number;
  jobsFailed: number;
  averageProcessingTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

export interface QueueStats {
  name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  totalProcessed: number;
  totalFailed: number;
  averageWaitingTime: number;
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  executionsPerMinute: number;
  queueSize: number;
  activeWorkers: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
}

// ─── Queue Manager ──────────────────────────────────────────────────────────

/**
 * Manages BullMQ queues for workflow execution.
 */
export class QueueManager {
  private config: ExecutorConfig;
  private queues: Map<string, Queue> = new Map();
  private status: ExecutorStatus = 'idle';

  constructor(config: ExecutorConfig) {
    this.config = config;
  }

  /**
   * Initialize the queue manager.
   */
  async initialize(): Promise<void> {
    logger.info('Initializing queue manager', {
      queuePrefix: this.config.queuePrefix,
      concurrency: this.config.concurrency,
    });

    // Create main execution queue
    const executionQueue = new Queue(
      `${this.config.queuePrefix}:executions`,
      this.config.redis
    );
    this.queues.set('executions', executionQueue);

    // Create priority queues
    for (const priority of ['low', 'normal', 'high', 'critical'] as JobPriority[]) {
      const queue = new Queue(
        `${this.config.queuePrefix}:priority:${priority}`,
        this.config.redis
      );
      this.queues.set(`priority:${priority}`, queue);
    }

    this.status = 'idle';
    logger.info('Queue manager initialized');
  }

  /**
   * Add a job to the queue.
   */
  async addJob(
    queueName: string,
    job: ExecutionRequest,
    priority: JobPriority = 'normal'
  ): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    const jobId = await queue.add(job, this.getPriorityValue(priority));

    logger.debug('Job added to queue', {
      jobId,
      queueName,
      priority,
      workflowId: job.workflowId,
    });

    return jobId;
  }

  /**
   * Get job from queue.
   */
  async getJob(queueName: string, jobId: string): Promise<ExecutionRequest | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    return queue.getJob(jobId);
  }

  /**
   * Remove job from queue.
   */
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    return queue.removeJob(jobId);
  }

  /**
   * Get queue statistics.
   */
  getQueueStats(queueName: string): QueueStats | null {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    return queue.getStats();
  }

  /**
   * Pause a queue.
   */
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.pause();
    }
  }

  /**
   * Resume a queue.
   */
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (queue) {
      await queue.resume();
    }
  }

  /**
   * Clean completed jobs.
   */
  async cleanJobs(queueName: string, maxAge: number): Promise<number> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return 0;
    }

    return queue.clean(maxAge);
  }

  /**
   * Shutdown the queue manager.
   */
  async shutdown(): Promise<void> {
    this.status = 'shutting-down';
    
    for (const [name, queue] of this.queues) {
      await queue.close();
    }
    this.queues.clear();

    logger.info('Queue manager shut down');
  }

  private getPriorityValue(priority: JobPriority): number {
    const values: Record<JobPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    };
    return values[priority];
  }
}

/**
 * Simple in-memory queue implementation (replace with BullMQ in production).
 */
class Queue {
  private name: string;
  private jobs: Map<string, QueueJob> = new Map();
  private processing: boolean = false;

  constructor(name: string, _redisConfig: RedisConfig) {
    this.name = name;
  }

  async add(data: unknown, priority: number): Promise<string> {
    const id = nanoid(24);
    const job: QueueJob = {
      id,
      data,
      priority,
      status: 'waiting',
      createdAt: new Date(),
      attempts: 0,
    };
    this.jobs.set(id, job);
    return id;
  }

  async getJob(id: string): Promise<unknown | null> {
    return this.jobs.get(id)?.data || null;
  }

  async removeJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async pause(): Promise<void> {
    this.processing = false;
  }

  async resume(): Promise<void> {
    this.processing = true;
  }

  async clean(maxAge: number): Promise<number> {
    const cutoff = Date.now() - maxAge;
    let cleaned = 0;

    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' && job.createdAt.getTime() < cutoff) {
        this.jobs.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  getStats() {
    const jobs = Array.from(this.jobs.values());
    return {
      name: this.name,
      counts: {
        waiting: jobs.filter(j => j.status === 'waiting').length,
        active: jobs.filter(j => j.status === 'active').length,
        completed: jobs.filter(j => j.status === 'completed').length,
        failed: jobs.filter(j => j.status === 'failed').length,
        delayed: jobs.filter(j => j.status === 'delayed').length,
        paused: jobs.filter(j => j.status === 'paused').length,
      },
      totalProcessed: jobs.filter(j => j.status === 'completed').length,
      totalFailed: jobs.filter(j => j.status === 'failed').length,
      averageWaitingTime: 0,
    };
  }

  async close(): Promise<void> {
    this.jobs.clear();
  }
}

interface QueueJob {
  id: string;
  data: unknown;
  priority: number;
  status: string;
  createdAt: Date;
  attempts: number;
}

// ─── Worker Process ─────────────────────────────────────────────────────────

/**
 * Worker process for executing workflow jobs.
 */
export class Worker {
  private id: string;
  private queueManager: QueueManager;
  private engine: WorkflowEngine;
  private config: ExecutorConfig;
  private status: 'idle' | 'busy' | 'stopped' = 'idle';
  private currentJob: string | null = null;
  private jobsProcessed: number = 0;
  private jobsFailed: number = 0;
  private totalProcessingTime: number = 0;
  private startTime: Date = new Date();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(queueManager: QueueManager, config: ExecutorConfig) {
    this.id = `worker_${nanoid(8)}`;
    this.queueManager = queueManager;
    this.engine = new WorkflowEngine();
    this.config = config;
  }

  /**
   * Start the worker.
   */
  async start(): Promise<void> {
    logger.info('Starting worker', { workerId: this.id });
    this.startTime = new Date();

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);

    this.status = 'idle';
    logger.info('Worker started', { workerId: this.id });
  }

  /**
   * Process a job.
   */
  async processJob(request: ExecutionRequest): Promise<ExecutionResult> {
    this.status = 'busy';
    this.currentJob = request.id;
    const startTime = Date.now();

    logger.info('Processing job', {
      workerId: this.id,
      jobId: request.id,
      workflowId: request.workflowId,
    });

    try {
      const result = await this.engine.execute(
        request.workflow,
        request.inputs,
        {
          ...request.options,
          onProgress: (progress) => {
            this.emitProgress(request.id, progress);
          },
        }
      );

      const processingTime = Date.now() - startTime;
      this.totalProcessingTime += processingTime;
      this.jobsProcessed++;

      logger.info('Job completed', {
        workerId: this.id,
        jobId: request.id,
        status: result.status,
        duration: result.duration,
        processingTime,
      });

      this.status = 'idle';
      this.currentJob = null;

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.totalProcessingTime += processingTime;
      this.jobsFailed++;

      logger.error('Job failed', {
        workerId: this.id,
        jobId: request.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      });

      this.status = 'idle';
      this.currentJob = null;

      throw error;
    }
  }

  /**
   * Get worker statistics.
   */
  getStats(): WorkerStats {
    return {
      workerId: this.id,
      status: this.status,
      currentJob: this.currentJob || undefined,
      jobsProcessed: this.jobsProcessed,
      jobsFailed: this.jobsFailed,
      averageProcessingTime: this.jobsProcessed > 0
        ? this.totalProcessingTime / this.jobsProcessed
        : 0,
      memoryUsage: process.memoryUsage(),
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Stop the worker.
   */
  async stop(): Promise<void> {
    logger.info('Stopping worker', { workerId: this.id });
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.status = 'stopped';
    logger.info('Worker stopped', { workerId: this.id });
  }

  private emitProgress(jobId: string, progress: ExecutionProgress): void {
    // Emit progress event
    const event = new CustomEvent('worker:progress', {
      detail: {
        workerId: this.id,
        jobId,
        progress,
      },
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  private sendHeartbeat(): void {
    logger.debug('Worker heartbeat', {
      workerId: this.id,
      status: this.status,
      jobsProcessed: this.jobsProcessed,
    });
  }
}

// ─── Execution Orchestrator ─────────────────────────────────────────────────

/**
 * Main orchestrator for workflow execution management.
 */
export class ExecutionOrchestrator {
  private config: ExecutorConfig;
  private queueManager: QueueManager;
  private workers: Map<string, Worker> = new Map();
  private engine: WorkflowEngine;
  private progress: Map<string, ExecutionProgress> = new Map();
  private metrics: ExecutionMetrics;
  private startTime: Date = new Date();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.config = {
      concurrency: 5,
      jobsPerWorker: 10,
      queuePrefix: 'workflow',
      redis: {
        host: 'localhost',
        port: 6379,
      },
      jobTimeout: 300000, // 5 minutes
      maxRetries: 3,
      retryDelay: 5000,
      cleanupInterval: 3600000, // 1 hour
      maxJobAge: 86400000, // 24 hours
      enableProgress: true,
      enableMetrics: true,
      ...config,
    };

    this.queueManager = new QueueManager(this.config);
    this.engine = new WorkflowEngine();
    this.metrics = this.createInitialMetrics();
  }

  /**
   * Initialize the orchestrator.
   */
  async initialize(): Promise<void> {
    logger.info('Initializing execution orchestrator', {
      concurrency: this.config.concurrency,
      queuePrefix: this.config.queuePrefix,
    });

    await this.queueManager.initialize();

    // Start workers
    for (let i = 0; i < this.config.concurrency; i++) {
      const worker = new Worker(this.queueManager, this.config);
      await worker.start();
      this.workers.set(worker.getStats().workerId, worker);
    }

    // Start cleanup interval
    if (this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupOldExecutions();
      }, this.config.cleanupInterval);
    }

    this.startTime = new Date();
    logger.info('Execution orchestrator initialized', {
      workerCount: this.workers.size,
    });
  }

  /**
   * Execute a workflow.
   */
  async execute(
    workflow: WorkflowDefinition,
    inputs: Record<string, unknown>,
    options: ExecutionOptions = {},
    metadata: Partial<ExecutionMetadata> = {}
  ): Promise<ExecutionResult> {
    const executionId = nanoid(24);
    const request: ExecutionRequest = {
      id: executionId,
      workflowId: workflow.id,
      workflow,
      inputs,
      options,
      priority: metadata.source === 'manual' ? 'high' : 'normal',
      metadata: {
        source: 'api',
        ...metadata,
      },
      createdAt: new Date(),
      status: 'queued',
    };

    logger.info('Queuing workflow execution', {
      executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      source: metadata.source,
    });

    // Add to queue
    await this.queueManager.addJob('executions', request, request.priority);

    // Initialize progress tracking
    if (this.config.enableProgress) {
      this.progress.set(executionId, {
        executionId,
        workflowId: workflow.id,
        status: 'queued',
        completedSteps: 0,
        totalSteps: workflow.steps.length,
        percentComplete: 0,
        startTime: new Date(),
      });
    }

    // Find available worker and process
    const worker = this.findAvailableWorker();
    if (worker) {
      request.status = 'processing';
      try {
        const result = await worker.processJob(request);
        request.status = 'completed';

        // Update progress
        if (this.config.enableProgress) {
          const progress = this.progress.get(executionId);
          if (progress) {
            progress.status = 'completed';
            progress.percentComplete = 100;
          }
        }

        return result;
      } catch (error) {
        request.status = 'failed';

        // Update progress
        if (this.config.enableProgress) {
          const progress = this.progress.get(executionId);
          if (progress) {
            progress.status = 'failed';
            progress.error = error instanceof Error ? error.message : 'Unknown error';
          }
        }

        throw error;
      }
    }

    // If no worker available, execute directly
    request.status = 'processing';
    try {
      const result = await this.engine.execute(workflow, inputs, options);
      request.status = 'completed';
      return result;
    } catch (error) {
      request.status = 'failed';
      throw error;
    }
  }

  /**
   * Cancel an execution.
   */
  async cancel(executionId: string): Promise<boolean> {
    const progress = this.progress.get(executionId);
    if (!progress) {
      return false;
    }

    if (progress.status === 'completed' || progress.status === 'failed') {
      return false;
    }

    // Remove from queue
    await this.queueManager.removeJob('executions', executionId);

    // Update progress
    progress.status = 'failed';
    progress.error = 'Execution cancelled';

    logger.info('Execution cancelled', { executionId });
    return true;
  }

  /**
   * Get execution progress.
   */
  getProgress(executionId: string): ExecutionProgress | null {
    return this.progress.get(executionId) || null;
  }

  /**
   * Get all execution progress.
   */
  getAllProgress(): ExecutionProgress[] {
    return Array.from(this.progress.values());
  }

  /**
   * Get orchestrator metrics.
   */
  getMetrics(): ExecutionMetrics {
    const allProgress = Array.from(this.progress.values());
    const completedExecutions = allProgress.filter(p => p.status === 'completed').length;
    const failedExecutions = allProgress.filter(p => p.status === 'failed').length;

    const executionTimes = allProgress
      .filter(p => p.startTime)
      .map(p => {
        const endTime = p.status === 'completed' || p.status === 'failed'
          ? new Date()
          : p.startTime!;
        return endTime.getTime() - p.startTime!.getTime();
      });

    const averageExecutionTime = executionTimes.length > 0
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : 0;

    const uptime = Date.now() - this.startTime.getTime();
    const executionsPerMinute = allProgress.length / (uptime / 60000);

    return {
      totalExecutions: allProgress.length,
      successfulExecutions: completedExecutions,
      failedExecutions,
      averageExecutionTime,
      executionsPerMinute,
      queueSize: allProgress.filter(p => p.status === 'queued').length,
      activeWorkers: Array.from(this.workers.values()).filter(w => w.getStats().status === 'busy').length,
      memoryUsage: process.memoryUsage(),
      uptime,
    };
  }

  /**
   * Get worker statistics.
   */
  getWorkerStats(): WorkerStats[] {
    return Array.from(this.workers.values()).map(w => w.getStats());
  }

  /**
   * Get queue statistics.
   */
  getQueueStats(): QueueStats | null {
    return this.queueManager.getQueueStats('executions');
  }

  /**
   * Pause the orchestrator.
   */
  async pause(): Promise<void> {
    await this.queueManager.pauseQueue('executions');
    logger.info('Orchestrator paused');
  }

  /**
   * Resume the orchestrator.
   */
  async resume(): Promise<void> {
    await this.queueManager.resumeQueue('executions');
    logger.info('Orchestrator resumed');
  }

  /**
   * Cleanup old executions.
   */
  async cleanupOldExecutions(): Promise<number> {
    const maxAge = this.config.maxJobAge;
    let cleaned = 0;

    // Clean queue
    cleaned += await this.queueManager.cleanJobs('executions', maxAge);

    // Clean progress tracking
    const cutoff = Date.now() - maxAge;
    for (const [id, progress] of this.progress) {
      if (progress.startTime && progress.startTime.getTime() < cutoff) {
        this.progress.delete(id);
        cleaned++;
      }
    }

    logger.info('Cleaned up old executions', { count: cleaned });
    return cleaned;
  }

  /**
   * Shutdown the orchestrator.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down execution orchestrator');

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all workers
    for (const [id, worker] of this.workers) {
      await worker.stop();
    }
    this.workers.clear();

    // Shutdown queue manager
    await this.queueManager.shutdown();

    // Clear progress
    this.progress.clear();

    logger.info('Execution orchestrator shut down');
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private findAvailableWorker(): Worker | null {
    for (const worker of this.workers.values()) {
      if (worker.getStats().status === 'idle') {
        return worker;
      }
    }
    return null;
  }

  private createInitialMetrics(): ExecutionMetrics {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      executionsPerMinute: 0,
      queueSize: 0,
      activeWorkers: 0,
      memoryUsage: process.memoryUsage(),
      uptime: 0,
    };
  }
}

// ─── Result Aggregator ──────────────────────────────────────────────────────

/**
 * Aggregates results from multiple workflow executions.
 */
export class ResultAggregator {
  private results: Map<string, ExecutionResult> = new Map();

  /**
   * Add a result.
   */
  addResult(result: ExecutionResult): void {
    this.results.set(result.executionId, result);
  }

  /**
   * Get aggregated results.
   */
  getAggregatedResults(): AggregatedResults {
    const allResults = Array.from(this.results.values());
    
    const successful = allResults.filter(r => r.status === 'completed');
    const failed = allResults.filter(r => r.status === 'failed');

    const totalDuration = allResults.reduce((sum, r) => sum + r.duration, 0);
    const averageDuration = allResults.length > 0 ? totalDuration / allResults.length : 0;

    const allErrors = allResults.flatMap(r => r.errors);
    const errorsByStep = new Map<string, number>();
    for (const error of allErrors) {
      const count = errorsByStep.get(error.stepId) || 0;
      errorsByStep.set(error.stepId, count + 1);
    }

    return {
      total: allResults.length,
      successful: successful.length,
      failed: failed.length,
      successRate: allResults.length > 0 ? successful.length / allResults.length : 0,
      averageDuration,
      totalDuration,
      errorsByStep: Object.fromEntries(errorsByStep),
      mostFrequentErrors: this.getMostFrequentErrors(allErrors),
    };
  }

  /**
   * Get results by workflow.
   */
  getResultsByWorkflow(workflowId: string): ExecutionResult[] {
    return Array.from(this.results.values())
      .filter(r => r.workflowId === workflowId);
  }

  /**
   * Get results by status.
   */
  getResultsByStatus(status: string): ExecutionResult[] {
    return Array.from(this.results.values())
      .filter(r => r.status === status);
  }

  /**
   * Clear old results.
   */
  clearOldResults(maxAge: number): number {
    const cutoff = Date.now() - maxAge;
    let cleared = 0;

    for (const [id, result] of this.results) {
      if (result.startTime.getTime() < cutoff) {
        this.results.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  private getMostFrequentErrors(errors: Array<{ code: string; message: string }>): Array<{ code: string; count: number }> {
    const errorCounts = new Map<string, number>();
    
    for (const error of errors) {
      const count = errorCounts.get(error.code) || 0;
      errorCounts.set(error.code, count + 1);
    }

    return Array.from(errorCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

export interface AggregatedResults {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  averageDuration: number;
  totalDuration: number;
  errorsByStep: Record<string, number>;
  mostFrequentErrors: Array<{ code: string; count: number }>;
}

// ─── Execution Monitor ──────────────────────────────────────────────────────

/**
 * Monitors workflow executions and provides real-time updates.
 */
export class ExecutionMonitor {
  private orchestrator: ExecutionOrchestrator;
  private listeners: Map<string, ExecutionListener> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(orchestrator: ExecutionOrchestrator) {
    this.orchestrator = orchestrator;
  }

  /**
   * Start monitoring.
   */
  startMonitoring(intervalMs: number = 5000): void {
    this.monitoringInterval = setInterval(() => {
      this.checkExecutions();
    }, intervalMs);

    logger.info('Execution monitoring started', { intervalMs });
  }

  /**
   * Stop monitoring.
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Execution monitoring stopped');
  }

  /**
   * Add a listener for execution events.
   */
  addListener(id: string, listener: ExecutionListener): void {
    this.listeners.set(id, listener);
  }

  /**
   * Remove a listener.
   */
  removeListener(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Get current execution status.
   */
  getStatus(): MonitorStatus {
    const metrics = this.orchestrator.getMetrics();
    const progress = this.orchestrator.getAllProgress();

    return {
      isActive: metrics.activeWorkers > 0,
      activeExecutions: progress.filter(p => p.status === 'processing').length,
      queuedExecutions: progress.filter(p => p.status === 'queued').length,
      completedExecutions: metrics.successfulExecutions,
      failedExecutions: metrics.failedExecutions,
      metrics,
    };
  }

  private checkExecutions(): void {
    const progress = this.orchestrator.getAllProgress();
    
    for (const p of progress) {
      // Check for stuck executions
      if (p.status === 'processing' && p.startTime) {
        const elapsed = Date.now() - p.startTime.getTime();
        if (elapsed > 600000) { // 10 minutes
          logger.warn('Execution appears stuck', {
            executionId: p.executionId,
            elapsed,
          });
        }
      }
    }

    // Notify listeners
    for (const listener of this.listeners.values()) {
      try {
        listener.onStatusChange?.(this.getStatus());
      } catch (error) {
        logger.error('Listener error', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  }
}

export interface ExecutionListener {
  onStatusChange?: (status: MonitorStatus) => void;
  onExecutionComplete?: (result: ExecutionResult) => void;
  onExecutionFailed?: (executionId: string, error: string) => void;
}

export interface MonitorStatus {
  isActive: boolean;
  activeExecutions: number;
  queuedExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  metrics: ExecutionMetrics;
}
