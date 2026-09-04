// Job queue utilities using in-memory implementation
// In production, replace with BullMQ + Redis

import { generateId } from './utils';

// ─── Types ───────────────────────────────────────────────
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';

export interface JobData {
  [key: string]: unknown;
}

export interface Job<T = JobData> {
  id: string;
  queueName: string;
  data: T;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  progress: number;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  processedAt?: Date;
  delay?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface JobOptions {
  priority?: number;
  attempts?: number;
  delay?: number;
  backoff?: { type: 'exponential' | 'fixed'; delay: number };
  removeOnComplete?: boolean;
  removeOnFail?: boolean;
  tags?: string[];
  timeout?: number;
}

export interface WorkerOptions {
  concurrency?: number;
  limiter?: { max: number; duration: number };
  lockDuration?: number;
}

export type JobHandler<T = JobData> = (job: Job<T>) => Promise<unknown>;

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

// ─── In-Memory Queue ─────────────────────────────────────
class InMemoryQueue {
  private jobs = new Map<string, Job>();
  private waitingQueue: string[] = [];
  private handlers = new Map<string, JobHandler>();
  private workers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private options: WorkerOptions;

  constructor(
    public readonly name: string,
    options?: WorkerOptions
  ) {
    this.options = { concurrency: 1, ...options };
  }

  async add<T = JobData>(
    data: T,
    options?: JobOptions
  ): Promise<Job<T>> {
    const job: Job<T> = {
      id: generateId(),
      queueName: this.name,
      data,
      status: options?.delay ? 'delayed' : 'waiting',
      priority: options?.priority ?? 0,
      attempts: 0,
      maxAttempts: options?.attempts ?? 3,
      progress: 0,
      createdAt: new Date(),
      delay: options?.delay,
      tags: options?.tags,
    };

    this.jobs.set(job.id, job as Job);

    if (options?.delay) {
      setTimeout(() => {
        const j = this.jobs.get(job.id);
        if (j && j.status === 'delayed') {
          j.status = 'waiting';
          this.waitingQueue.push(job.id);
          this.processNext();
        }
      }, options.delay);
    } else {
      this.waitingQueue.push(job.id);
      this.processNext();
    }

    return job;
  }

  async process(handler: JobHandler): Promise<void> {
    this.handlers.set(this.name, handler);
  }

  private async processNext(): Promise<void> {
    if (this.waitingQueue.length === 0) return;

    const activeCount = Array.from(this.jobs.values()).filter(
      (j) => j.status === 'active'
    ).length;

    if (activeCount >= (this.options.concurrency || 1)) return;

    const jobId = this.waitingQueue.shift();
    if (!jobId) return;

    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'waiting') return;

    const handler = this.handlers.get(this.name);
    if (!handler) return;

    job.status = 'active';
    job.startedAt = new Date();
    job.attempts++;

    try {
      const result = await handler(job);
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date();
      job.progress = 100;
    } catch (error) {
      if (job.attempts < job.maxAttempts) {
        job.status = 'waiting';
        job.attempts--;
        this.waitingQueue.push(jobId);
        setTimeout(() => this.processNext(), 1000);
      } else {
        job.status = 'failed';
        job.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      job.processedAt = new Date();
    }
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.jobs.get(id);
  }

  async getJobs(status?: JobStatus): Promise<Job[]> {
    return Array.from(this.jobs.values()).filter(
      (j) => !status || j.status === status
    );
  }

  async getStats(): Promise<QueueStats> {
    const jobs = Array.from(this.jobs.values());
    return {
      waiting: jobs.filter((j) => j.status === 'waiting').length,
      active: jobs.filter((j) => j.status === 'active').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
      delayed: jobs.filter((j) => j.status === 'delayed').length,
      total: jobs.length,
    };
  }

  async removeJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async retryJob(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job || job.status !== 'failed') return false;
    job.status = 'waiting';
    job.attempts = 0;
    job.error = undefined;
    this.waitingQueue.push(id);
    this.processNext();
    return true;
  }

  async pause(): Promise<void> {
    this.workers.forEach((interval) => clearInterval(interval));
    this.workers.clear();
  }

  async resume(): Promise<void> {
    this.processNext();
  }

  async close(): Promise<void> {
    this.workers.forEach((interval) => clearInterval(interval));
    this.workers.clear();
    this.jobs.clear();
    this.waitingQueue = [];
  }
}

// ─── Queue Manager ───────────────────────────────────────
const queues = new Map<string, InMemoryQueue>();

export function getQueue(name: string, options?: WorkerOptions): InMemoryQueue {
  if (!queues.has(name)) {
    queues.set(name, new InMemoryQueue(name, options));
  }
  return queues.get(name)!;
}

export async function closeAllQueues(): Promise<void> {
  for (const queue of queues.values()) {
    await queue.close();
  }
  queues.clear();
}

// ─── Worker Base Class ───────────────────────────────────
export abstract class BaseWorker<T = JobData> {
  protected queue: InMemoryQueue;
  protected concurrency: number;

  constructor(queueName: string, options?: WorkerOptions) {
    this.concurrency = options?.concurrency || 1;
    this.queue = getQueue(queueName, options);
    this.queue.process(this.handle.bind(this));
  }

  abstract handle(job: Job<T>): Promise<unknown>;

  async add(data: T, options?: JobOptions): Promise<Job<T>> {
    return this.queue.add<T>(data, options);
  }

  async getJob(id: string): Promise<Job | undefined> {
    return this.queue.getJob(id);
  }

  async getStats(): Promise<QueueStats> {
    return this.queue.getStats();
  }
}

// ─── Job Types Registry ──────────────────────────────────
export enum JobType {
  WORKFLOW_EXECUTE = 'workflow:execute',
  WORKFLOW_RETRY = 'workflow:retry',
  EMAIL_SEND = 'email:send',
  EMAIL_BULK = 'email:bulk',
  NOTIFICATION_SEND = 'notification:send',
  DATA_SYNC = 'data:sync',
  DATA_EXPORT = 'data:export',
  DATA_IMPORT = 'data:import',
  FILE_PROCESS = 'file:process',
  REPORT_GENERATE = 'report:generate',
  WEBHOOK_TRIGGER = 'webhook:trigger',
  SCHEDULED_TASK = 'scheduled:task',
  INTEGRATION_SYNC = 'integration:sync',
  BILLING_PROCESS = 'billing:process',
  ANALYTICS_AGGREGATE = 'analytics:aggregate',
}

// ─── Retry Strategies ────────────────────────────────────
export function exponentialBackoff(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
}

export function fixedDelay(delay: number): number {
  return delay;
}

// ─── Delayed Jobs ────────────────────────────────────────
export async function addDelayedJob<T = JobData>(
  queueName: string,
  data: T,
  delayMs: number,
  options?: JobOptions
): Promise<Job<T>> {
  const queue = getQueue(queueName);
  return queue.add(data, { ...options, delay: delayMs });
}

// ─── Rate Limiting ───────────────────────────────────────
const rateLimitCounters = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const counter = rateLimitCounters.get(key);

  if (!counter || now > counter.resetAt) {
    rateLimitCounters.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  counter.count++;
  return counter.count > max;
}

// ─── Job Progress Tracking ───────────────────────────────
export function updateJobProgress(jobId: string, progress: number): void {
  const allQueues = Array.from(queues.values());
  for (const queue of allQueues) {
    queue.getJob(jobId).then((job) => {
      if (job) job.progress = Math.min(100, Math.max(0, progress));
    });
  }
}

// ─── Queue Monitoring ────────────────────────────────────
export async function getAllQueueStats(): Promise<Record<string, QueueStats>> {
  const stats: Record<string, QueueStats> = {};
  for (const [name, queue] of queues.entries()) {
    stats[name] = await queue.getStats();
  }
  return stats;
}

export async function getQueueHealth(): Promise<{
  healthy: boolean;
  queues: Record<string, { status: string; stats: QueueStats }>;
}> {
  const queueStats = await getAllQueueStats();
  const healthy = Object.values(queueStats).every((s) => s.failed < 100);

  const queues: Record<string, { status: string; stats: QueueStats }> = {};
  for (const [name, stats] of Object.entries(queueStats)) {
    queues[name] = {
      status: stats.active > 0 ? 'processing' : stats.waiting > 0 ? 'pending' : 'idle',
      stats,
    };
  }

  return { healthy, queues };
}
