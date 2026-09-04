/**
 * Workflow Cron Job Scheduler
 * 
 * Manages cron-based scheduling for workflow execution with
 * timezone support, overlap detection, and graceful shutdown.
 * 
 * @module workflow/scheduler
 */

import { logger } from '@/lib/logger';
import { CronExpression, parseExpression } from 'cron-parser';

// ─── Types ──────────────────────────────────────────────────────────────────

export type SchedulerStatus = 'running' | 'paused' | 'stopped';

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  timezone: string;
  handler: ScheduledJobHandler;
  config: JobConfig;
  status: 'active' | 'paused' | 'completed' | 'failed';
  createdAt: Date;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
  lastError?: string;
}

export interface JobConfig {
  /** Start date for job execution */
  startDate?: Date;
  /** End date for job execution */
  endDate?: Date;
  /** Maximum number of executions */
  maxExecutions?: number;
  /** Skip weekends */
  skipWeekends?: boolean;
  /** Skip holidays */
  skipHolidays?: boolean;
  /** Holiday dates */
  holidays?: Date[];
  /** Job timeout in milliseconds */
  timeoutMs?: number;
  /** Whether to skip overlapping executions */
  skipOverlap?: boolean;
  /** Retry configuration on failure */
  retry?: JobRetryConfig;
  /** Job metadata */
  metadata?: Record<string, unknown>;
}

export interface JobRetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
}

export interface JobExecution {
  id: string;
  jobId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  duration?: number;
  error?: string;
  result?: unknown;
}

export interface SchedulerStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalExecutions: number;
  lastExecutionTime?: Date;
  averageExecutionTime: number;
}

export type ScheduledJobHandler = (context: JobContext) => Promise<unknown>;

export interface JobContext {
  jobId: string;
  executionId: string;
  scheduledTime: Date;
  previousExecution?: Date;
  metadata?: Record<string, unknown>;
}

// ─── Cron Parser ────────────────────────────────────────────────────────────

/**
 * Parses and validates cron expressions with timezone support.
 */
export class CronParser {
  /**
   * Parse a cron expression and get the next execution time.
   */
  static getNextExecution(
    expression: string,
    timezone: string = 'UTC',
    after?: Date
  ): Date {
    try {
      const interval = parseExpression(expression, {
        currentDate: after || new Date(),
        timezone,
      });
      return interval.next().toDate();
    } catch (error) {
      throw new CronParseError(
        `Invalid cron expression: ${expression}`,
        expression,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get multiple future execution times.
   */
  static getNextExecutions(
    expression: string,
    timezone: string = 'UTC',
    count: number = 5,
    after?: Date
  ): Date[] {
    try {
      const interval = parseExpression(expression, {
        currentDate: after || new Date(),
        timezone,
      });
      
      const dates: Date[] = [];
      for (let i = 0; i < count; i++) {
        dates.push(interval.next().toDate());
      }
      return dates;
    } catch (error) {
      throw new CronParseError(
        `Invalid cron expression: ${expression}`,
        expression,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validate a cron expression.
   */
  static validate(expression: string): ValidationResult {
    try {
      parseExpression(expression);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Invalid cron expression'],
      };
    }
  }

  /**
   * Get a human-readable description of a cron expression.
   */
  static describe(expression: string): string {
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      return 'Invalid expression';
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const descriptions: string[] = [];

    // Minute
    if (minute === '*') {
      descriptions.push('every minute');
    } else if (minute.includes('/')) {
      const [, interval] = minute.split('/');
      descriptions.push(`every ${interval} minutes`);
    } else {
      descriptions.push(`at minute ${minute}`);
    }

    // Hour
    if (hour === '*') {
      descriptions.push('of every hour');
    } else if (hour.includes('/')) {
      const [, interval] = hour.split('/');
      descriptions.push(`every ${interval} hours`);
    } else {
      descriptions.push(`at ${hour}:00`);
    }

    // Day of month
    if (dayOfMonth !== '*') {
      descriptions.push(`on day ${dayOfMonth}`);
    }

    // Month
    if (month !== '*') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (month.includes(',')) {
        const months = month.split(',').map(m => monthNames[parseInt(m) - 1]);
        descriptions.push(`in ${months.join(', ')}`);
      } else {
        descriptions.push(`in ${monthNames[parseInt(month) - 1]}`);
      }
    }

    // Day of week
    if (dayOfWeek !== '*') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      if (dayOfWeek.includes(',')) {
        const days = dayOfWeek.split(',').map(d => dayNames[parseInt(d)]);
        descriptions.push(`on ${days.join(', ')}`);
      } else {
        descriptions.push(`on ${dayNames[parseInt(dayOfWeek)]}`);
      }
    }

    return descriptions.join(' ');
  }

  /**
   * Check if a cron expression matches a specific time.
   */
  static matches(expression: string, date: Date, timezone: string = 'UTC'): boolean {
    try {
      const interval = parseExpression(expression, {
        currentDate: date,
        timezone,
      });
      const nextDate = interval.next().toDate();
      
      // Check if the next date is within 1 second of the given date
      return Math.abs(nextDate.getTime() - date.getTime()) < 1000;
    } catch {
      return false;
    }
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class CronParseError extends Error {
  public readonly expression: string;
  public readonly cause?: Error;

  constructor(message: string, expression: string, cause?: Error) {
    super(message);
    this.name = 'CronParseError';
    this.expression = expression;
    this.cause = cause;
  }
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

/**
 * Manages scheduled jobs with cron-based execution.
 */
export class CronScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private executions: Map<string, JobExecution[]> = new Map();
  private status: SchedulerStatus = 'stopped';
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startScheduler();
  }

  /**
   * Add a new scheduled job.
   */
  async addJob(
    id: string,
    cronExpression: string,
    timezone: string,
    handler: ScheduledJobHandler,
    config: Partial<JobConfig> = {}
  ): Promise<ScheduledJob> {
    // Validate cron expression
    const validation = CronParser.validate(cronExpression);
    if (!validation.valid) {
      throw new CronParseError(
        `Invalid cron expression: ${cronExpression}`,
        cronExpression
      );
    }

    const now = new Date();
    const nextRun = CronParser.getNextExecution(cronExpression, timezone, now);

    const job: ScheduledJob = {
      id,
      name: config.metadata?.name as string || id,
      cronExpression,
      timezone,
      handler,
      config: {
        skipOverlap: true,
        retry: {
          maxAttempts: 3,
          delayMs: 5000,
          backoffMultiplier: 2,
        },
        ...config,
      },
      status: 'active',
      createdAt: now,
      nextRun,
      runCount: 0,
      errorCount: 0,
    };

    this.jobs.set(id, job);
    this.executions.set(id, []);

    logger.info('Job added to scheduler', {
      jobId: id,
      cronExpression,
      timezone,
      nextRun: nextRun.toISOString(),
    });

    // Schedule the first run
    this.scheduleNextRun(job);

    return job;
  }

  /**
   * Remove a scheduled job.
   */
  removeJob(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const removed = this.jobs.delete(id);
    this.executions.delete(id);

    if (removed) {
      logger.info('Job removed from scheduler', { jobId: id });
    }

    return removed;
  }

  /**
   * Pause a scheduled job.
   */
  async pauseJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    job.status = 'paused';
    logger.info('Job paused', { jobId: id });
  }

  /**
   * Resume a paused job.
   */
  async resumeJob(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    job.status = 'active';
    this.scheduleNextRun(job);

    logger.info('Job resumed', { jobId: id });
  }

  /**
   * Enable a job (alias for resume).
   */
  async enableJob(id: string): Promise<void> {
    return this.resumeJob(id);
  }

  /**
   * Disable a job (alias for pause).
   */
  async disableJob(id: string): Promise<void> {
    return this.pauseJob(id);
  }

  /**
   * Manually trigger a job execution.
   */
  async triggerJob(id: string): Promise<JobExecution> {
    const job = this.jobs.get(id);
    if (!job) {
      throw new Error(`Job not found: ${id}`);
    }

    return this.executeJob(job);
  }

  /**
   * Get job by ID.
   */
  getJob(id: string): ScheduledJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Get all jobs.
   */
  getAllJobs(): ScheduledJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job execution history.
   */
  getJobExecutions(jobId: string): JobExecution[] {
    return this.executions.get(jobId) || [];
  }

  /**
   * Get scheduler statistics.
   */
  getStats(): SchedulerStats {
    const jobs = Array.from(this.jobs.values());
    const allExecutions = Array.from(this.executions.values()).flat();

    const activeJobs = jobs.filter(j => j.status === 'active').length;
    const pausedJobs = jobs.filter(j => j.status === 'paused').length;
    const completedJobs = jobs.filter(j => j.status === 'completed').length;
    const failedJobs = jobs.filter(j => j.status === 'failed').length;

    const completedExecutions = allExecutions.filter(e => e.status === 'completed');
    const averageExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0) / completedExecutions.length
      : 0;

    const lastExecution = allExecutions
      .filter(e => e.endTime)
      .sort((a, b) => b.endTime!.getTime() - a.endTime!.getTime())[0];

    return {
      totalJobs: jobs.length,
      activeJobs,
      pausedJobs,
      completedJobs,
      failedJobs,
      totalExecutions: allExecutions.length,
      lastExecutionTime: lastExecution?.endTime,
      averageExecutionTime,
    };
  }

  /**
   * Graceful shutdown.
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down scheduler');
    this.status = 'stopped';

    // Clear all timers
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Wait for running jobs to complete
    const runningJobs = Array.from(this.jobs.values())
      .filter(job => job.status === 'active');

    for (const job of runningJobs) {
      await this.pauseJob(job.id);
    }

    logger.info('Scheduler shutdown complete');
  }

  // ─── Private Methods ──────────────────────────────────────────────────────

  private startScheduler(): void {
    this.status = 'running';

    // Check for jobs to run every second
    this.checkInterval = setInterval(() => {
      this.checkScheduledJobs();
    }, 1000);

    logger.info('Scheduler started');
  }

  private checkScheduledJobs(): void {
    const now = new Date();

    for (const job of this.jobs.values()) {
      if (job.status !== 'active' || !job.nextRun) {
        continue;
      }

      // Check if it's time to run
      if (now >= job.nextRun) {
        this.executeJob(job).catch(error => {
          logger.error('Job execution failed', {
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }
  }

  private scheduleNextRun(job: ScheduledJob): void {
    try {
      const nextRun = CronParser.getNextExecution(
        job.cronExpression,
        job.timezone,
        new Date()
      );

      // Check if job has reached end date
      if (job.config.endDate && nextRun > job.config.endDate) {
        job.status = 'completed';
        logger.info('Job completed (reached end date)', { jobId: job.id });
        return;
      }

      // Check if job has reached max executions
      if (job.config.maxExecutions && job.runCount >= job.config.maxExecutions) {
        job.status = 'completed';
        logger.info('Job completed (reached max executions)', {
          jobId: job.id,
          runCount: job.runCount,
        });
        return;
      }

      // Check if should skip weekends
      if (job.config.skipWeekends && this.isWeekend(nextRun)) {
        // Schedule for next weekday
        const nextWeekday = this.getNextWeekday(nextRun);
        job.nextRun = nextWeekday;
        this.scheduleNextRun(job);
        return;
      }

      // Check if should skip holidays
      if (job.config.skipHolidays && job.config.holidays) {
        const isHoliday = job.config.holidays.some(holiday =>
          this.isSameDay(holiday, nextRun)
        );
        if (isHoliday) {
          // Schedule for next day
          const nextDay = new Date(nextRun);
          nextDay.setDate(nextDay.getDate() + 1);
          job.nextRun = nextDay;
          this.scheduleNextRun(job);
          return;
        }
      }

      job.nextRun = nextRun;

      // Calculate delay until next run
      const delay = nextRun.getTime() - Date.now();
      if (delay < 0) {
        // Should have run already, run now
        this.executeJob(job);
        return;
      }

      // Set timer for next run
      const timer = setTimeout(() => {
        this.executeJob(job);
      }, delay);

      this.timers.set(job.id, timer);

      logger.debug('Job scheduled', {
        jobId: job.id,
        nextRun: nextRun.toISOString(),
        delay,
      });
    } catch (error) {
      logger.error('Failed to schedule job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async executeJob(job: ScheduledJob): Promise<JobExecution> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date();

    const execution: JobExecution = {
      id: executionId,
      jobId: job.id,
      startTime,
      status: 'running',
    };

    // Store execution
    const executions = this.executions.get(job.id) || [];
    executions.push(execution);
    this.executions.set(job.id, executions);

    // Check for overlapping executions
    if (job.config.skipOverlap) {
      const runningExecutions = executions.filter(
        e => e.status === 'running' && e.id !== executionId
      );
      if (runningExecutions.length > 0) {
        execution.status = 'completed';
        execution.endTime = new Date();
        execution.duration = 0;
        logger.info('Skipping overlapping execution', {
          jobId: job.id,
          executionId,
        });
        this.scheduleNextRun(job);
        return execution;
      }
    }

    try {
      // Create job context
      const context: JobContext = {
        jobId: job.id,
        executionId,
        scheduledTime: startTime,
        previousExecution: job.lastRun,
        metadata: job.config.metadata,
      };

      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => job.handler(context),
        job.config.timeoutMs || 300000 // 5 minutes default
      );

      // Update execution
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();
      execution.status = 'completed';
      execution.result = result;

      // Update job
      job.lastRun = startTime;
      job.runCount++;
      job.status = 'active';

      logger.info('Job executed successfully', {
        jobId: job.id,
        executionId,
        duration: execution.duration,
        runCount: job.runCount,
      });
    } catch (error) {
      const endTime = new Date();
      execution.endTime = endTime;
      execution.duration = endTime.getTime() - startTime.getTime();
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      job.errorCount++;
      job.lastError = execution.error;

      // Retry logic
      if (job.config.retry && job.config.retry.maxAttempts > 0) {
        await this.retryJob(job, execution);
      } else {
        job.status = 'failed';
      }

      logger.error('Job execution failed', {
        jobId: job.id,
        executionId,
        error: execution.error,
        duration: execution.duration,
      });
    }

    // Schedule next run
    this.scheduleNextRun(job);

    return execution;
  }

  private async retryJob(job: ScheduledJob, failedExecution: JobExecution): Promise<void> {
    const retryConfig = job.config.retry!;
    let attempt = 0;

    while (attempt < retryConfig.maxAttempts) {
      attempt++;

      const delay = retryConfig.delayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1);
      logger.info('Retrying job', {
        jobId: job.id,
        attempt,
        delay,
      });

      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const context: JobContext = {
          jobId: job.id,
          executionId: `retry_${Date.now()}`,
          scheduledTime: new Date(),
          previousExecution: job.lastRun,
          metadata: job.config.metadata,
        };

        await job.handler(context);

        logger.info('Job retry succeeded', {
          jobId: job.id,
          attempt,
        });
        return;
      } catch (error) {
        logger.warn('Job retry failed', {
          jobId: job.id,
          attempt,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    job.status = 'failed';
  }

  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Job execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  private getNextWeekday(date: Date): Date {
    const next = new Date(date);
    while (this.isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }
}

// ─── Timezone Utilities ─────────────────────────────────────────────────────

/**
 * Utility functions for timezone handling.
 */
export class TimezoneUtils {
  /**
   * Get the current time in a specific timezone.
   */
  static getCurrentTime(timezone: string): Date {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    
    const dateParts: Record<string, string> = {};
    for (const part of parts) {
      dateParts[part.type] = part.value;
    }

    return new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`
    );
  }

  /**
   * Convert a date to a different timezone.
   */
  static convertToTimezone(date: Date, timezone: string): Date {
    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(date);
    
    const dateParts: Record<string, string> = {};
    for (const part of parts) {
      dateParts[part.type] = part.value;
    }

    return new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`
    );
  }

  /**
   * Get offset between two timezones.
   */
  static getTimezoneOffset(
    timezone1: string,
    timezone2: string,
    date: Date = new Date()
  ): number {
    const time1 = this.convertToTimezone(date, timezone1);
    const time2 = this.convertToTimezone(date, timezone2);
    
    return time1.getTime() - time2.getTime();
  }

  /**
   * Check if a timezone is valid.
   */
  static isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all available timezones.
   */
  static getAvailableTimezones(): string[] {
    return Intl.supportedValuesOf('timeZone');
  }
}

// ─── Holiday Calendar ───────────────────────────────────────────────────────

/**
 * Manages holiday calendars for scheduler.
 */
export class HolidayCalendar {
  private holidays: Map<string, Date[]> = new Map();

  /**
   * Add holidays for a country.
   */
  addHolidays(country: string, holidays: Date[]): void {
    const existing = this.holidays.get(country) || [];
    this.holidays.set(country, [...existing, ...holidays]);
  }

  /**
   * Check if a date is a holiday.
   */
  isHoliday(date: Date, country: string = 'US'): boolean {
    const holidays = this.holidays.get(country) || [];
    return holidays.some(holiday => this.isSameDay(holiday, date));
  }

  /**
   * Get holidays for a country.
   */
  getHolidays(country: string): Date[] {
    return this.holidays.get(country) || [];
  }

  /**
   * Get next business day after a date.
   */
  getNextBusinessDay(date: Date, country: string = 'US'): Date {
    const next = new Date(date);
    while (this.isHoliday(next, country) || this.isWeekend(next)) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
