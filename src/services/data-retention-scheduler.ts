/**
 * Data Retention Policy Scheduler
 * 
 * Implements automated data retention policy enforcement through scheduled
 * cleanup operations. Ensures compliance with privacy regulations and
 * organizational data retention policies.
 * 
 * Requirements: 8.2, 8.3
 */

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db';
import { 
  createPrivacyProtectionService, 
  type IPrivacyProtectionService,
  type DataPurgeResult 
} from './privacy-protection';
import { createAuditService, type IAuditService, type AuditContext } from './audit';

// Scheduler interfaces
export interface ScheduledCleanupJob {
  id: string;
  tenantId?: string; // undefined for system-wide cleanup
  scheduledAt: Date;
  executedAt?: Date;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  result?: DataPurgeResult;
  errors: string[];
}

export interface CleanupSchedule {
  enabled: boolean;
  dailyCleanupTime: string; // HH:MM format (24-hour)
  weeklyDeepCleanup: boolean;
  weeklyCleanupDay: number; // 0-6 (Sunday-Saturday)
  monthlyFullPurge: boolean;
  monthlyPurgeDay: number; // 1-31
}

export interface DataRetentionMetrics {
  totalTenantsProcessed: number;
  totalReceiptsDeleted: number;
  totalJobsDeleted: number;
  totalR2ObjectsDeleted: number;
  totalErrors: number;
  processingTimeMs: number;
  lastRunAt: Date;
  nextRunAt: Date;
}

// Data retention scheduler service
export interface IDataRetentionScheduler {
  scheduleCleanup(tenantId?: string): Promise<ScheduledCleanupJob>;
  executeScheduledCleanup(jobId: string): Promise<ScheduledCleanupJob>;
  getCleanupSchedule(): CleanupSchedule;
  updateCleanupSchedule(schedule: Partial<CleanupSchedule>): Promise<void>;
  getRetentionMetrics(): Promise<DataRetentionMetrics>;
  runSystemWideCleanup(): Promise<DataPurgeResult>;
}

export class DataRetentionScheduler implements IDataRetentionScheduler {
  private privacyProtectionService: IPrivacyProtectionService;
  private auditService: IAuditService;
  private cleanupJobs: Map<string, ScheduledCleanupJob> = new Map();
  private schedule: CleanupSchedule;

  // Default cleanup schedule
  private static readonly DEFAULT_SCHEDULE: CleanupSchedule = {
    enabled: true,
    dailyCleanupTime: '02:00', // 2 AM daily
    weeklyDeepCleanup: true,
    weeklyCleanupDay: 0, // Sunday
    monthlyFullPurge: true,
    monthlyPurgeDay: 1 // First day of month
  };

  constructor(
    db: DrizzleD1Database<typeof schema>, 
    r2Bucket: R2Bucket,
    schedule?: Partial<CleanupSchedule>
  ) {
    this.privacyProtectionService = createPrivacyProtectionService(db, r2Bucket);
    this.auditService = createAuditService(db);
    this.schedule = { ...DataRetentionScheduler.DEFAULT_SCHEDULE, ...schedule };
  }

  /**
   * Schedule cleanup for a specific tenant or system-wide
   * Requirements: 8.2
   */
  async scheduleCleanup(tenantId?: string): Promise<ScheduledCleanupJob> {
    try {
      const jobId = this.generateJobId();
      const scheduledAt = this.calculateNextCleanupTime();

      const job: ScheduledCleanupJob = {
        id: jobId,
        scheduledAt,
        status: 'PENDING',
        errors: []
      };

      // Add tenantId only if provided
      if (tenantId) {
        job.tenantId = tenantId;
      }

      // Store job in memory (in production, this would be in a persistent queue)
      this.cleanupJobs.set(jobId, job);

      // Log cleanup scheduling
      const auditContext: AuditContext = {
        resource: `Data retention cleanup scheduled: ${jobId}, tenant: ${tenantId || 'system-wide'}, scheduled for: ${scheduledAt.toISOString()}`
      };
      
      if (tenantId) {
        auditContext.tenantId = tenantId;
      }

      await this.auditService.logSensitiveOperation('DATA_RETENTION_CLEANUP_SCHEDULED', auditContext);

      return job;

    } catch (error) {
      const errorMessage = `Failed to schedule cleanup: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      const auditContext: AuditContext = {
        resource: errorMessage
      };
      
      if (tenantId) {
        auditContext.tenantId = tenantId;
      }

      await this.auditService.logSensitiveOperation('DATA_RETENTION_CLEANUP_SCHEDULE_FAILED', auditContext);
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Execute a scheduled cleanup job
   * Requirements: 8.2, 8.3
   */
  async executeScheduledCleanup(jobId: string): Promise<ScheduledCleanupJob> {
    const job = this.cleanupJobs.get(jobId);
    if (!job) {
      throw new Error(`Cleanup job ${jobId} not found`);
    }

    try {
      // Update job status
      job.status = 'RUNNING';
      job.executedAt = new Date();
      this.cleanupJobs.set(jobId, job);

      // Log cleanup execution start
      const auditContext: AuditContext = {
        resource: `Data retention cleanup started: ${jobId}, tenant: ${job.tenantId || 'system-wide'}`
      };
      
      if (job.tenantId) {
        auditContext.tenantId = job.tenantId;
      }

      await this.auditService.logSensitiveOperation('DATA_RETENTION_CLEANUP_STARTED', auditContext);

      // Execute cleanup
      let result: DataPurgeResult;
      if (job.tenantId) {
        // Tenant-specific cleanup
        result = await this.privacyProtectionService.applyDataRetentionPolicy(job.tenantId);
      } else {
        // System-wide cleanup
        result = await this.privacyProtectionService.purgeExpiredData();
      }

      // Update job with results
      job.result = result;
      job.status = result.errors.length === 0 ? 'COMPLETED' : 'FAILED';
      job.errors = result.errors;
      this.cleanupJobs.set(jobId, job);

      // Log cleanup completion
      const completionAuditContext: AuditContext = {
        resource: `Data retention cleanup completed: ${jobId}, status: ${job.status}, receipts deleted: ${result.receiptsDeleted}, jobs deleted: ${result.processingJobsDeleted}, errors: ${result.errors.length}`
      };
      
      if (job.tenantId) {
        completionAuditContext.tenantId = job.tenantId;
      }

      await this.auditService.logSensitiveOperation('DATA_RETENTION_CLEANUP_COMPLETED', completionAuditContext);

      return job;

    } catch (error) {
      // Update job with error
      job.status = 'FAILED';
      job.errors.push(`Cleanup execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.cleanupJobs.set(jobId, job);

      // Log cleanup failure
      const failureAuditContext: AuditContext = {
        resource: `Data retention cleanup failed: ${jobId}, error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
      
      if (job.tenantId) {
        failureAuditContext.tenantId = job.tenantId;
      }

      await this.auditService.logSensitiveOperation('DATA_RETENTION_CLEANUP_FAILED', failureAuditContext);

      return job;
    }
  }

  /**
   * Get current cleanup schedule configuration
   * Requirements: 8.2
   */
  getCleanupSchedule(): CleanupSchedule {
    return { ...this.schedule };
  }

  /**
   * Update cleanup schedule configuration
   * Requirements: 8.2
   */
  async updateCleanupSchedule(schedule: Partial<CleanupSchedule>): Promise<void> {
    try {
      const oldSchedule = { ...this.schedule };
      this.schedule = { ...this.schedule, ...schedule };

      // Log schedule update
      const auditContext: AuditContext = {
        resource: `Data retention schedule updated: ${JSON.stringify({ old: oldSchedule, new: this.schedule })}`
      };

      await this.auditService.logSensitiveOperation('DATA_RETENTION_SCHEDULE_UPDATED', auditContext);

    } catch (error) {
      const auditContext: AuditContext = {
        resource: `Data retention schedule update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      await this.auditService.logSensitiveOperation('DATA_RETENTION_SCHEDULE_UPDATE_FAILED', auditContext);
      
      throw new Error(`Failed to update cleanup schedule: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get data retention metrics and statistics
   * Requirements: 8.2
   */
  async getRetentionMetrics(): Promise<DataRetentionMetrics> {
    try {
      const completedJobs = Array.from(this.cleanupJobs.values())
        .filter(job => job.status === 'COMPLETED' && job.result);

      const totalReceiptsDeleted = completedJobs.reduce((sum, job) => 
        sum + (job.result?.receiptsDeleted || 0), 0);
      
      const totalJobsDeleted = completedJobs.reduce((sum, job) => 
        sum + (job.result?.processingJobsDeleted || 0), 0);
      
      const totalR2ObjectsDeleted = completedJobs.reduce((sum, job) => 
        sum + (job.result?.r2ObjectsDeleted || 0), 0);
      
      const totalErrors = Array.from(this.cleanupJobs.values())
        .reduce((sum, job) => sum + job.errors.length, 0);

      // Calculate processing time from most recent job
      const recentJob = Array.from(this.cleanupJobs.values())
        .filter(job => job.executedAt)
        .sort((a, b) => (b.executedAt?.getTime() || 0) - (a.executedAt?.getTime() || 0))[0];

      const processingTimeMs = recentJob && recentJob.executedAt && recentJob.scheduledAt
        ? recentJob.executedAt.getTime() - recentJob.scheduledAt.getTime()
        : 0;

      const lastRunAt = recentJob?.executedAt || new Date(0);
      const nextRunAt = this.calculateNextCleanupTime();

      return {
        totalTenantsProcessed: new Set(completedJobs.map(job => job.tenantId).filter(Boolean)).size,
        totalReceiptsDeleted,
        totalJobsDeleted,
        totalR2ObjectsDeleted,
        totalErrors,
        processingTimeMs,
        lastRunAt,
        nextRunAt
      };

    } catch (error) {
      console.error('Failed to get retention metrics:', error);
      throw new Error(`Failed to get retention metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Run immediate system-wide cleanup
   * Requirements: 8.2, 8.3
   */
  async runSystemWideCleanup(): Promise<DataPurgeResult> {
    try {
      // Log system-wide cleanup start
      const auditContext: AuditContext = {
        resource: 'System-wide data retention cleanup initiated'
      };

      await this.auditService.logSensitiveOperation('SYSTEM_WIDE_CLEANUP_STARTED', auditContext);

      // Execute system-wide cleanup
      const result = await this.privacyProtectionService.purgeExpiredData();

      // Log system-wide cleanup completion
      const completionAuditContext: AuditContext = {
        resource: `System-wide cleanup completed: receipts deleted: ${result.receiptsDeleted}, jobs deleted: ${result.processingJobsDeleted}, R2 objects deleted: ${result.r2ObjectsDeleted}, errors: ${result.errors.length}`
      };

      await this.auditService.logSensitiveOperation('SYSTEM_WIDE_CLEANUP_COMPLETED', completionAuditContext);

      return result;

    } catch (error) {
      const auditContext: AuditContext = {
        resource: `System-wide cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      await this.auditService.logSensitiveOperation('SYSTEM_WIDE_CLEANUP_FAILED', auditContext);
      
      throw new Error(`System-wide cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate next cleanup time based on schedule
   */
  private calculateNextCleanupTime(): Date {
    const now = new Date();
    const [hours, minutes] = this.schedule.dailyCleanupTime.split(':').map(Number);
    
    if (hours === undefined || minutes === undefined) {
      throw new Error('Invalid cleanup time format');
    }
    
    const nextCleanup = new Date(now);
    nextCleanup.setHours(hours, minutes, 0, 0);
    
    // If the time has already passed today, schedule for tomorrow
    if (nextCleanup <= now) {
      nextCleanup.setDate(nextCleanup.getDate() + 1);
    }
    
    return nextCleanup;
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `cleanup_${timestamp}_${random}`;
  }
}

/**
 * Factory function to create DataRetentionScheduler instance
 */
export function createDataRetentionScheduler(
  db: DrizzleD1Database<typeof schema>, 
  r2Bucket: R2Bucket,
  schedule?: Partial<CleanupSchedule>
): IDataRetentionScheduler {
  return new DataRetentionScheduler(db, r2Bucket, schedule);
}

/**
 * Cloudflare Cron trigger handler for scheduled cleanup
 * This function should be exported and used as the cron handler in the worker
 */
export async function handleScheduledCleanup(
  env: { DB: D1Database; RECEIPT_BUCKET: R2Bucket }
): Promise<void> {
  const db = drizzle(env.DB, { schema });
  const scheduler = createDataRetentionScheduler(db, env.RECEIPT_BUCKET);

  try {
    console.log('Starting scheduled data retention cleanup');
    
    // Run system-wide cleanup
    const result = await scheduler.runSystemWideCleanup();
    
    console.log('Scheduled cleanup completed:', {
      receiptsDeleted: result.receiptsDeleted,
      jobsDeleted: result.processingJobsDeleted,
      r2ObjectsDeleted: result.r2ObjectsDeleted,
      errors: result.errors.length
    });

  } catch (error) {
    console.error('Scheduled cleanup failed:', error);
    throw error;
  }
}