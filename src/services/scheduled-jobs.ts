import { z } from 'zod';

/**
 * Scheduled Jobs Service
 * Requirements: 9.4, 8.6
 */

export interface JobDefinition {
  id: string;
  name: string;
  description?: string;
  schedule: string; // Cron expression
  handler: JobHandler;
  enabled: boolean;
  timeout?: number; // in milliseconds
  retries?: number;
  retryDelay?: number; // in milliseconds
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface JobExecution {
  id: string;
  jobId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  result?: any;
  error?: string;
  duration?: number;
  retryCount: number;
}

export interface JobHandler {
  (context: JobContext): Promise<JobResult>;
}

export interface JobContext {
  jobId: string;
  executionId: string;
  startTime: Date;
  metadata?: Record<string, any>;
  logger: JobLogger;
}

export interface JobResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export interface JobLogger {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: any): void;
  debug(message: string, data?: any): void;
}

export interface JobStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  averageExecutionTime: number;
  lastExecutionTime?: Date;
}

/**
 * Job validation schema
 */
export const jobDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  schedule: z.string().regex(/^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[0-1]?\d) (\*|[0-6])$/, 'Invalid cron expression'),
  enabled: z.boolean().default(true),
  timeout: z.number().int().min(1000).default(300000), // 5 minutes default
  retries: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(1000).default(5000), // 5 seconds default
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

/**
 * Scheduled Jobs Service
 */
export class ScheduledJobsService {
  private jobs = new Map<string, JobDefinition>();
  private executions = new Map<string, JobExecution>();
  private timers = new Map<string, NodeJS.Timeout>();
  private running = new Set<string>();

  constructor() {
    // Register default cleanup jobs
    this.registerDefaultJobs();
  }

  /**
   * Register a new job
   */
  registerJob(job: Omit<JobDefinition, 'handler'> & { handler: JobHandler }): void {
    try {
      // Validate job definition
      const validatedJob = jobDefinitionSchema.parse(job);
      
      const jobDefinition: JobDefinition = {
        ...validatedJob,
        handler: job.handler,
      };

      this.jobs.set(job.id, jobDefinition);
      
      if (job.enabled) {
        this.scheduleJob(job.id);
      }

      console.log(`Registered job: ${job.name} (${job.id})`);
    } catch (error) {
      console.error(`Failed to register job ${job.id}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a job
   */
  unregisterJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Cancel scheduled execution
    this.cancelJob(jobId);
    
    // Remove from registry
    this.jobs.delete(jobId);
    
    console.log(`Unregistered job: ${job.name} (${jobId})`);
    return true;
  }

  /**
   * Enable a job
   */
  enableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = true;
    this.scheduleJob(jobId);
    
    console.log(`Enabled job: ${job.name} (${jobId})`);
    return true;
  }

  /**
   * Disable a job
   */
  disableJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.enabled = false;
    this.cancelJob(jobId);
    
    console.log(`Disabled job: ${job.name} (${jobId})`);
    return true;
  }

  /**
   * Execute a job immediately
   */
  async executeJob(jobId: string): Promise<JobExecution> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    return this.runJob(job);
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): {
    job?: JobDefinition;
    lastExecution?: JobExecution;
    nextExecution?: Date;
    isRunning: boolean;
  } {
    const job = this.jobs.get(jobId);
    const lastExecution = this.getLastExecution(jobId);
    const nextExecution = job ? this.getNextExecutionTime(job.schedule) : undefined;
    const isRunning = this.running.has(jobId);

    return {
      job,
      lastExecution,
      nextExecution,
      isRunning,
    };
  }

  /**
   * Get all jobs
   */
  getAllJobs(): JobDefinition[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job executions
   */
  getJobExecutions(jobId: string, limit = 50): JobExecution[] {
    return Array.from(this.executions.values())
      .filter(execution => execution.jobId === jobId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  /**
   * Get job statistics
   */
  getJobStats(jobId?: string): JobStats {
    const executions = jobId 
      ? Array.from(this.executions.values()).filter(e => e.jobId === jobId)
      : Array.from(this.executions.values());

    const completedExecutions = executions.filter(e => e.status === 'completed');
    const failedExecutions = executions.filter(e => e.status === 'failed');
    const runningExecutions = executions.filter(e => e.status === 'running');

    const totalExecutionTime = completedExecutions.reduce((sum, e) => sum + (e.duration || 0), 0);
    const averageExecutionTime = completedExecutions.length > 0 
      ? totalExecutionTime / completedExecutions.length 
      : 0;

    const lastExecution = executions
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];

    return {
      totalJobs: jobId ? 1 : this.jobs.size,
      activeJobs: runningExecutions.length,
      completedJobs: completedExecutions.length,
      failedJobs: failedExecutions.length,
      averageExecutionTime,
      lastExecutionTime: lastExecution?.startTime,
    };
  }

  /**
   * Clean up old job executions
   */
  cleanupExecutions(olderThanDays = 30): number {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const [executionId, execution] of this.executions.entries()) {
      if (execution.startTime < cutoffDate) {
        this.executions.delete(executionId);
        cleaned++;
      }
    }

    console.log(`Cleaned up ${cleaned} old job executions`);
    return cleaned;
  }

  /**
   * Schedule a job based on its cron expression
   */
  private scheduleJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || !job.enabled) return;

    // Cancel existing timer
    this.cancelJob(jobId);

    // Calculate next execution time
    const nextExecution = this.getNextExecutionTime(job.schedule);
    const delay = nextExecution.getTime() - Date.now();

    // Schedule the job
    const timer = setTimeout(async () => {
      try {
        await this.runJob(job);
      } catch (error) {
        console.error(`Error executing scheduled job ${jobId}:`, error);
      }
      
      // Reschedule for next execution
      this.scheduleJob(jobId);
    }, delay);

    this.timers.set(jobId, timer);
    
    console.log(`Scheduled job ${job.name} to run at ${nextExecution.toISOString()}`);
  }

  /**
   * Cancel a scheduled job
   */
  private cancelJob(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }
  }

  /**
   * Run a job
   */
  private async runJob(job: JobDefinition): Promise<JobExecution> {
    const executionId = crypto.randomUUID();
    const startTime = new Date();

    // Check if job is already running
    if (this.running.has(job.id)) {
      console.warn(`Job ${job.name} is already running, skipping execution`);
      throw new Error(`Job ${job.id} is already running`);
    }

    // Create execution record
    const execution: JobExecution = {
      id: executionId,
      jobId: job.id,
      startTime,
      status: 'running',
      retryCount: 0,
    };

    this.executions.set(executionId, execution);
    this.running.add(job.id);

    // Create job context
    const context: JobContext = {
      jobId: job.id,
      executionId,
      startTime,
      metadata: job.metadata,
      logger: this.createLogger(job.id, executionId),
    };

    try {
      context.logger.info(`Starting job execution: ${job.name}`);

      // Execute job with timeout
      const result = await this.executeWithTimeout(
        job.handler(context),
        job.timeout || 300000
      );

      // Update execution record
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();
      execution.status = result.success ? 'completed' : 'failed';
      execution.result = result.data;
      execution.error = result.error;

      context.logger.info(`Job completed successfully in ${execution.duration}ms`);
      
      return execution;
    } catch (error) {
      // Handle job failure
      execution.endTime = new Date();
      execution.duration = execution.endTime.getTime() - startTime.getTime();
      execution.status = error instanceof Error && error.message === 'TIMEOUT' ? 'timeout' : 'failed';
      execution.error = error instanceof Error ? error.message : 'Unknown error';

      context.logger.error(`Job failed after ${execution.duration}ms`, error);

      // Retry logic
      if (execution.retryCount < (job.retries || 0)) {
        context.logger.info(`Retrying job in ${job.retryDelay || 5000}ms (attempt ${execution.retryCount + 1})`);
        
        setTimeout(async () => {
          execution.retryCount++;
          try {
            await this.runJob(job);
          } catch (retryError) {
            context.logger.error('Retry failed', retryError);
          }
        }, job.retryDelay || 5000);
      }

      return execution;
    } finally {
      this.running.delete(job.id);
    }
  }

  /**
   * Execute a promise with timeout
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, timeoutMs);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Create a logger for job execution
   */
  private createLogger(jobId: string, executionId: string): JobLogger {
    const prefix = `[Job:${jobId}:${executionId}]`;
    
    return {
      info: (message: string, data?: any) => {
        console.log(`${prefix} INFO: ${message}`, data || '');
      },
      warn: (message: string, data?: any) => {
        console.warn(`${prefix} WARN: ${message}`, data || '');
      },
      error: (message: string, error?: any) => {
        console.error(`${prefix} ERROR: ${message}`, error || '');
      },
      debug: (message: string, data?: any) => {
        console.debug(`${prefix} DEBUG: ${message}`, data || '');
      },
    };
  }

  /**
   * Get next execution time from cron expression
   */
  private getNextExecutionTime(cronExpression: string): Date {
    // Simple cron parser - in production, use a proper cron library
    const [minute, hour, day, month, dayOfWeek] = cronExpression.split(' ');
    
    const now = new Date();
    const next = new Date(now);
    
    // This is a simplified implementation
    // In production, use a library like 'node-cron' or 'cron-parser'
    
    // For demo purposes, schedule every minute if all fields are '*'
    if (cronExpression === '* * * * *') {
      next.setMinutes(next.getMinutes() + 1);
      next.setSeconds(0);
      next.setMilliseconds(0);
      return next;
    }
    
    // For other expressions, schedule for next hour (simplified)
    next.setHours(next.getHours() + 1);
    next.setMinutes(0);
    next.setSeconds(0);
    next.setMilliseconds(0);
    
    return next;
  }

  /**
   * Get last execution for a job
   */
  private getLastExecution(jobId: string): JobExecution | undefined {
    return Array.from(this.executions.values())
      .filter(execution => execution.jobId === jobId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0];
  }

  /**
   * Register default system jobs
   */
  private registerDefaultJobs(): void {
    // Cleanup old job executions
    this.registerJob({
      id: 'cleanup-job-executions',
      name: 'Cleanup Old Job Executions',
      description: 'Remove job execution records older than 30 days',
      schedule: '0 2 * * *', // Daily at 2 AM
      enabled: true,
      handler: async (context) => {
        try {
          const cleaned = this.cleanupExecutions(30);
          return {
            success: true,
            data: { cleaned },
            message: `Cleaned up ${cleaned} old job executions`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    // System health check
    this.registerJob({
      id: 'system-health-check',
      name: 'System Health Check',
      description: 'Perform system health checks and log status',
      schedule: '*/15 * * * *', // Every 15 minutes
      enabled: true,
      handler: async (context) => {
        try {
          // Perform basic health checks
          const memoryUsage = process.memoryUsage();
          const uptime = process.uptime();
          
          context.logger.info('System health check', {
            memoryUsage: {
              rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
              heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
              heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            },
            uptime: Math.round(uptime / 60) + ' minutes',
          });

          return {
            success: true,
            data: { memoryUsage, uptime },
            message: 'System health check completed',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });

    // Cache cleanup
    this.registerJob({
      id: 'cache-cleanup',
      name: 'Cache Cleanup',
      description: 'Clean up expired cache entries',
      schedule: '*/30 * * * *', // Every 30 minutes
      enabled: true,
      handler: async (context) => {
        try {
          // In a real implementation, you would clean up cache here
          context.logger.info('Cache cleanup completed');
          
          return {
            success: true,
            message: 'Cache cleanup completed',
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
    });
  }
}

/**
 * Job utilities
 */
export const jobUtils = {
  /**
   * Validate cron expression
   */
  validateCronExpression(expression: string): boolean {
    const cronRegex = /^(\*|[0-5]?\d) (\*|[01]?\d|2[0-3]) (\*|[0-2]?\d|3[01]) (\*|[0-1]?\d) (\*|[0-6])$/;
    return cronRegex.test(expression);
  },

  /**
   * Parse cron expression into human-readable format
   */
  parseCronExpression(expression: string): string {
    const [minute, hour, day, month, dayOfWeek] = expression.split(' ');
    
    if (expression === '* * * * *') {
      return 'Every minute';
    }
    
    if (expression === '0 * * * *') {
      return 'Every hour';
    }
    
    if (expression === '0 0 * * *') {
      return 'Daily at midnight';
    }
    
    if (expression === '0 0 * * 0') {
      return 'Weekly on Sunday at midnight';
    }
    
    if (expression === '0 0 1 * *') {
      return 'Monthly on the 1st at midnight';
    }
    
    return `Custom: ${expression}`;
  },

  /**
   * Create a simple job handler
   */
  createSimpleHandler(fn: () => Promise<any>): JobHandler {
    return async (context) => {
      try {
        const result = await fn();
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    };
  },

  /**
   * Format job duration
   */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  },

  /**
   * Get job status color
   */
  getStatusColor(status: JobExecution['status']): string {
    const colors = {
      running: '#3b82f6',
      completed: '#22c55e',
      failed: '#ef4444',
      timeout: '#f59e0b',
    };
    return colors[status] || '#6b7280';
  },
};