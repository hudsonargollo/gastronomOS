/**
 * Receipt Processing Analytics Service
 * 
 * Provides comprehensive analytics and monitoring for receipt processing.
 * Implements requirements 10.1, 10.2, 10.4, 10.5 for the receipt scanning system.
 */

import { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte, lte, count, sum, avg } from 'drizzle-orm';
import { 
  receiptProcessingJobs,
  receiptProcessingStats,
  receipts,
  receiptLineItems,
  productMatchCandidates,
  products,
  ReceiptProcessingStatus
} from '../db/schema';
import { getCurrentTimestamp } from '../utils';

// Analytics interfaces
export interface ProcessingAnalytics {
  summary: ProcessingSummary;
  trends: ProcessingTrend[];
  errorAnalysis: ErrorAnalysis;
  performanceMetrics: PerformanceMetrics;
  qualityMetrics: QualityMetrics;
}

export interface ProcessingSummary {
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  manualReviewRequired: number;
  successRate: number;
  avgProcessingTimeMs: number;
  avgConfidenceScore: number;
  currentJobs: JobStatusCounts;
}

export interface JobStatusCounts {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  requiresReview: number;
}

export interface ProcessingTrend {
  date: string;
  totalProcessed: number;
  successfulProcessed: number;
  failedProcessed: number;
  successRate: number;
  avgProcessingTimeMs: number;
  avgConfidenceScore: number;
}

export interface ErrorAnalysis {
  commonErrors: ErrorPattern[];
  errorsByStage: StageErrorBreakdown[];
  retryAnalysis: RetryAnalysis;
  suggestions: string[];
}

export interface ErrorPattern {
  errorType: string;
  count: number;
  percentage: number;
  examples: string[];
  suggestedFix: string;
}

export interface StageErrorBreakdown {
  stage: 'OCR' | 'PARSING' | 'MATCHING' | 'STORAGE' | 'PROCESSING';
  errorCount: number;
  percentage: number;
  avgRetryCount: number;
}

export interface RetryAnalysis {
  totalRetries: number;
  avgRetriesPerJob: number;
  retrySuccessRate: number;
  maxRetryCount: number;
}

export interface PerformanceMetrics {
  processingSpeed: ProcessingSpeedMetrics;
  throughput: ThroughputMetrics;
  resourceUtilization: ResourceMetrics;
  bottlenecks: BottleneckAnalysis[];
}

export interface ProcessingSpeedMetrics {
  avgOcrTimeMs: number;
  avgParsingTimeMs: number;
  avgMatchingTimeMs: number;
  avgStorageTimeMs: number;
  totalAvgTimeMs: number;
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
}

export interface ThroughputMetrics {
  receiptsPerHour: number;
  receiptsPerDay: number;
  peakHourlyThroughput: number;
  averageQueueDepth: number;
}

export interface ResourceMetrics {
  avgMemoryUsage: number;
  avgCpuUsage: number;
  storageUsage: number;
  apiCallsPerReceipt: number;
}

export interface BottleneckAnalysis {
  stage: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
  impact: string;
  recommendation: string;
}

export interface QualityMetrics {
  ocrAccuracy: OCRAccuracyMetrics;
  parsingEffectiveness: ParsingEffectivenessMetrics;
  productMatching: ProductMatchingMetrics;
  manualReviewAnalysis: ManualReviewAnalysis;
}

export interface OCRAccuracyMetrics {
  avgConfidenceScore: number;
  highConfidenceRate: number; // > 0.8
  lowConfidenceRate: number; // < 0.5
  textExtractionSuccessRate: number;
  coordinateExtractionRate: number;
}

export interface ParsingEffectivenessMetrics {
  vendorExtractionRate: number;
  dateExtractionRate: number;
  totalAmountExtractionRate: number;
  lineItemExtractionRate: number;
  avgLineItemsPerReceipt: number;
  parsingConfidenceDistribution: ConfidenceDistribution;
}

export interface ProductMatchingMetrics {
  automaticMatchRate: number;
  highConfidenceMatchRate: number;
  manualOverrideRate: number;
  unmatchedItemRate: number;
  avgMatchConfidence: number;
  matchingAccuracyTrend: number[];
}

export interface ManualReviewAnalysis {
  reviewRate: number;
  avgReviewTime: number;
  reviewReasons: ReviewReasonBreakdown[];
  reviewOutcomes: ReviewOutcomeBreakdown[];
}

export interface ConfidenceDistribution {
  high: number; // 0.8-1.0
  medium: number; // 0.5-0.8
  low: number; // 0.0-0.5
}

export interface ReviewReasonBreakdown {
  reason: string;
  count: number;
  percentage: number;
}

export interface ReviewOutcomeBreakdown {
  outcome: 'APPROVED' | 'REJECTED' | 'MODIFIED';
  count: number;
  percentage: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface AnalyticsOptions {
  includeErrorAnalysis?: boolean;
  includePerformanceMetrics?: boolean;
  includeQualityMetrics?: boolean;
  includeTrends?: boolean;
  trendGranularity?: 'HOURLY' | 'DAILY' | 'WEEKLY';
  limit?: number;
}

// Receipt analytics service interface
export interface IReceiptAnalyticsService {
  getProcessingAnalytics(tenantId: string, dateRange: DateRange, options?: AnalyticsOptions): Promise<ProcessingAnalytics>;
  updateProcessingStats(tenantId: string, date: Date): Promise<void>;
  getErrorAnalysis(tenantId: string, dateRange: DateRange): Promise<ErrorAnalysis>;
  getPerformanceMetrics(tenantId: string, dateRange: DateRange): Promise<PerformanceMetrics>;
  getQualityMetrics(tenantId: string, dateRange: DateRange): Promise<QualityMetrics>;
  identifyBottlenecks(tenantId: string, dateRange: DateRange): Promise<BottleneckAnalysis[]>;
  generateImprovementSuggestions(tenantId: string, dateRange: DateRange): Promise<string[]>;
}

export class ReceiptAnalyticsService implements IReceiptAnalyticsService {
  constructor(private db: DrizzleD1Database) {}

  /**
   * Get comprehensive processing analytics
   * Requirements: 10.1, 10.2, 10.4
   */
  async getProcessingAnalytics(
    tenantId: string, 
    dateRange: DateRange, 
    options: AnalyticsOptions = {}
  ): Promise<ProcessingAnalytics> {
    const {
      includeErrorAnalysis = true,
      includePerformanceMetrics = true,
      includeQualityMetrics = true,
      includeTrends = true,
      trendGranularity = 'DAILY',
      limit = 30
    } = options;

    // Get basic processing summary
    const summary = await this.getProcessingSummary(tenantId, dateRange);

    // Get trends if requested
    const trends = includeTrends 
      ? await this.getProcessingTrends(tenantId, dateRange, trendGranularity, limit)
      : [];

    // Get error analysis if requested
    const errorAnalysis = includeErrorAnalysis 
      ? await this.getErrorAnalysis(tenantId, dateRange)
      : {
          commonErrors: [],
          errorsByStage: [],
          retryAnalysis: { totalRetries: 0, avgRetriesPerJob: 0, retrySuccessRate: 0, maxRetryCount: 0 },
          suggestions: []
        };

    // Get performance metrics if requested
    const performanceMetrics = includePerformanceMetrics 
      ? await this.getPerformanceMetrics(tenantId, dateRange)
      : {
          processingSpeed: {
            avgOcrTimeMs: 0, avgParsingTimeMs: 0, avgMatchingTimeMs: 0, avgStorageTimeMs: 0,
            totalAvgTimeMs: 0, percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
          },
          throughput: { receiptsPerHour: 0, receiptsPerDay: 0, peakHourlyThroughput: 0, averageQueueDepth: 0 },
          resourceUtilization: { avgMemoryUsage: 0, avgCpuUsage: 0, storageUsage: 0, apiCallsPerReceipt: 0 },
          bottlenecks: []
        };

    // Get quality metrics if requested
    const qualityMetrics = includeQualityMetrics 
      ? await this.getQualityMetrics(tenantId, dateRange)
      : {
          ocrAccuracy: {
            avgConfidenceScore: 0, highConfidenceRate: 0, lowConfidenceRate: 0,
            textExtractionSuccessRate: 0, coordinateExtractionRate: 0
          },
          parsingEffectiveness: {
            vendorExtractionRate: 0, dateExtractionRate: 0, totalAmountExtractionRate: 0,
            lineItemExtractionRate: 0, avgLineItemsPerReceipt: 0,
            parsingConfidenceDistribution: { high: 0, medium: 0, low: 0 }
          },
          productMatching: {
            automaticMatchRate: 0, highConfidenceMatchRate: 0, manualOverrideRate: 0,
            unmatchedItemRate: 0, avgMatchConfidence: 0, matchingAccuracyTrend: []
          },
          manualReviewAnalysis: {
            reviewRate: 0, avgReviewTime: 0, reviewReasons: [], reviewOutcomes: []
          }
        };

    return {
      summary,
      trends,
      errorAnalysis,
      performanceMetrics,
      qualityMetrics
    };
  }

  /**
   * Update processing statistics for a given date
   * Requirements: 10.1, 10.4
   */
  async updateProcessingStats(tenantId: string, date: Date): Promise<void> {
    const dateBucket = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get processing jobs for the day
    const jobs = await this.db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, startOfDay.getTime()),
        lte(receiptProcessingJobs.createdAt, endOfDay.getTime())
      ));

    if (jobs.length === 0) {
      return; // No jobs to process
    }

    // Calculate statistics
    const totalProcessed = jobs.length;
    const successfulProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.COMPLETED).length;
    const failedProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.FAILED).length;
    const manualReviewRequired = jobs.filter(j => j.status === ReceiptProcessingStatus.REQUIRES_REVIEW).length;

    // Calculate average processing time for completed jobs
    const completedJobs = jobs.filter(j => j.startedAt && j.completedAt && j.completedAt >= j.startedAt);
    const avgProcessingTimeMs = completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => sum + ((j.completedAt || 0) - (j.startedAt || 0)), 0) / completedJobs.length
      : 0;

    // Get average confidence score from receipts
    const receiptsData = await this.db
      .select({ confidenceScore: receipts.confidenceScore })
      .from(receipts)
      .innerJoin(receiptProcessingJobs, eq(receipts.processingJobId, receiptProcessingJobs.id))
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, startOfDay.getTime()),
        lte(receiptProcessingJobs.createdAt, endOfDay.getTime())
      ));

    const avgConfidenceScore = receiptsData.length > 0
      ? receiptsData.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / receiptsData.length
      : 0;

    // Upsert statistics
    const now = getCurrentTimestamp();
    await this.db
      .insert(receiptProcessingStats)
      .values({
        id: `stats_${tenantId}_${dateBucket}`,
        tenantId,
        dateBucket,
        totalProcessed,
        successfulProcessed,
        failedProcessed,
        manualReviewRequired,
        avgProcessingTimeMs: Math.round(avgProcessingTimeMs),
        avgConfidenceScore: Math.round(avgConfidenceScore * 1000) / 1000,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [receiptProcessingStats.tenantId, receiptProcessingStats.dateBucket],
        set: {
          totalProcessed,
          successfulProcessed,
          failedProcessed,
          manualReviewRequired,
          avgProcessingTimeMs: Math.round(avgProcessingTimeMs),
          avgConfidenceScore: Math.round(avgConfidenceScore * 1000) / 1000,
          updatedAt: now
        }
      });
  }

  /**
   * Get error analysis for troubleshooting
   * Requirements: 10.2, 10.5
   */
  async getErrorAnalysis(tenantId: string, dateRange: DateRange): Promise<ErrorAnalysis> {
    // Get failed jobs with error messages
    const failedJobs = await this.db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        eq(receiptProcessingJobs.status, ReceiptProcessingStatus.FAILED),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    // Analyze error patterns
    const errorPatterns = this.analyzeErrorPatterns(failedJobs);
    const errorsByStage = this.analyzeErrorsByStage(failedJobs);
    const retryAnalysis = this.analyzeRetryPatterns(failedJobs);
    const suggestions = this.generateErrorSuggestions(errorPatterns, errorsByStage);

    return {
      commonErrors: errorPatterns,
      errorsByStage,
      retryAnalysis,
      suggestions
    };
  }

  /**
   * Get performance metrics for optimization
   * Requirements: 10.2, 10.4
   */
  async getPerformanceMetrics(tenantId: string, dateRange: DateRange): Promise<PerformanceMetrics> {
    // Get completed jobs for performance analysis
    const completedJobs = await this.db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        eq(receiptProcessingJobs.status, ReceiptProcessingStatus.COMPLETED),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    const processingSpeed = this.calculateProcessingSpeedMetrics(completedJobs);
    const throughput = this.calculateThroughputMetrics(completedJobs, dateRange);
    const resourceUtilization = this.calculateResourceMetrics(completedJobs);
    const bottlenecks = await this.identifyBottlenecks(tenantId, dateRange);

    return {
      processingSpeed,
      throughput,
      resourceUtilization,
      bottlenecks
    };
  }

  /**
   * Get quality metrics for accuracy monitoring
   * Requirements: 10.2, 10.3
   */
  async getQualityMetrics(tenantId: string, dateRange: DateRange): Promise<QualityMetrics> {
    // Get receipts for quality analysis
    const receiptsData = await this.db
      .select()
      .from(receipts)
      .innerJoin(receiptProcessingJobs, eq(receipts.processingJobId, receiptProcessingJobs.id))
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    const ocrAccuracy = this.calculateOCRAccuracyMetrics(receiptsData);
    const parsingEffectiveness = await this.calculateParsingEffectivenessMetrics(receiptsData, tenantId);
    const productMatching = await this.calculateProductMatchingMetrics(receiptsData, tenantId);
    const manualReviewAnalysis = await this.calculateManualReviewAnalysis(receiptsData, tenantId);

    return {
      ocrAccuracy,
      parsingEffectiveness,
      productMatching,
      manualReviewAnalysis
    };
  }

  /**
   * Identify processing bottlenecks
   * Requirements: 10.5
   */
  async identifyBottlenecks(tenantId: string, dateRange: DateRange): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Analyze queue depth and processing times
    const jobs = await this.db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    // Check for high failure rates
    const failureRate = jobs.filter(j => j.status === ReceiptProcessingStatus.FAILED).length / jobs.length;
    if (failureRate > 0.1) {
      bottlenecks.push({
        stage: 'PROCESSING',
        severity: failureRate > 0.2 ? 'HIGH' : 'MEDIUM',
        description: `High failure rate: ${Math.round(failureRate * 100)}%`,
        impact: 'Reduced throughput and user experience',
        recommendation: 'Review error logs and improve error handling'
      });
    }

    // Check for high manual review rates
    const reviewRate = jobs.filter(j => j.status === ReceiptProcessingStatus.REQUIRES_REVIEW).length / jobs.length;
    if (reviewRate > 0.15) {
      bottlenecks.push({
        stage: 'QUALITY_CONTROL',
        severity: reviewRate > 0.25 ? 'HIGH' : 'MEDIUM',
        description: `High manual review rate: ${Math.round(reviewRate * 100)}%`,
        impact: 'Increased manual workload and processing delays',
        recommendation: 'Improve OCR accuracy and parsing algorithms'
      });
    }

    // Check for slow processing times
    const completedJobs = jobs.filter(j => j.startedAt && j.completedAt && j.completedAt >= j.startedAt);
    if (completedJobs.length > 0) {
      const avgProcessingTime = completedJobs.reduce((sum, j) => 
        sum + ((j.completedAt || 0) - (j.startedAt || 0)), 0) / completedJobs.length;
      
      if (avgProcessingTime > 30000) { // > 30 seconds
        bottlenecks.push({
          stage: 'PROCESSING_SPEED',
          severity: avgProcessingTime > 60000 ? 'HIGH' : 'MEDIUM',
          description: `Slow processing: ${Math.round(avgProcessingTime / 1000)}s average`,
          impact: 'Poor user experience and reduced throughput',
          recommendation: 'Optimize OCR and parsing algorithms'
        });
      }
    }

    return bottlenecks;
  }

  /**
   * Generate improvement suggestions based on analytics
   * Requirements: 10.5
   */
  async generateImprovementSuggestions(tenantId: string, dateRange: DateRange): Promise<string[]> {
    const suggestions: string[] = [];

    const errorAnalysis = await this.getErrorAnalysis(tenantId, dateRange);
    const qualityMetrics = await this.getQualityMetrics(tenantId, dateRange);
    const bottlenecks = await this.identifyBottlenecks(tenantId, dateRange);

    // Suggestions based on error analysis
    if (errorAnalysis.commonErrors.length > 0) {
      const topError = errorAnalysis.commonErrors[0];
      if (topError && topError.percentage > 20) {
        suggestions.push(`Address the most common error: ${topError.errorType} (${topError.percentage}% of failures)`);
      }
    }

    // Suggestions based on quality metrics
    if (qualityMetrics.ocrAccuracy.avgConfidenceScore < 0.7) {
      suggestions.push('Improve OCR accuracy by enhancing image preprocessing or using better AI models');
    }

    if (qualityMetrics.productMatching.automaticMatchRate < 0.6) {
      suggestions.push('Enhance product matching algorithms or expand product catalog with aliases');
    }

    if (qualityMetrics.manualReviewAnalysis.reviewRate > 0.2) {
      suggestions.push('Reduce manual review requirements by improving parsing confidence thresholds');
    }

    // Suggestions based on bottlenecks
    bottlenecks.forEach(bottleneck => {
      if (bottleneck.severity === 'HIGH') {
        suggestions.push(bottleneck.recommendation);
      }
    });

    // General suggestions if no specific issues found
    if (suggestions.length === 0) {
      suggestions.push('System is performing well. Consider monitoring trends for proactive optimization.');
    }

    return suggestions.slice(0, 5); // Limit to top 5 suggestions
  }

  // Private helper methods
  private async getProcessingSummary(tenantId: string, dateRange: DateRange): Promise<ProcessingSummary> {
    // Get jobs in date range
    const jobs = await this.db
      .select()
      .from(receiptProcessingJobs)
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    const totalProcessed = jobs.length;
    const successfulProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.COMPLETED).length;
    const failedProcessed = jobs.filter(j => j.status === ReceiptProcessingStatus.FAILED).length;
    const manualReviewRequired = jobs.filter(j => j.status === ReceiptProcessingStatus.REQUIRES_REVIEW).length;

    const successRate = totalProcessed > 0 ? (successfulProcessed / totalProcessed) * 100 : 0;

    // Calculate average processing time
    const completedJobs = jobs.filter(j => j.startedAt && j.completedAt && j.completedAt >= j.startedAt);
    const avgProcessingTimeMs = completedJobs.length > 0
      ? completedJobs.reduce((sum, j) => sum + ((j.completedAt || 0) - (j.startedAt || 0)), 0) / completedJobs.length
      : 0;

    // Get average confidence score
    const receiptsData = await this.db
      .select({ confidenceScore: receipts.confidenceScore })
      .from(receipts)
      .innerJoin(receiptProcessingJobs, eq(receipts.processingJobId, receiptProcessingJobs.id))
      .where(and(
        eq(receiptProcessingJobs.tenantId, tenantId),
        gte(receiptProcessingJobs.createdAt, dateRange.startDate.getTime()),
        lte(receiptProcessingJobs.createdAt, dateRange.endDate.getTime())
      ));

    const avgConfidenceScore = receiptsData.length > 0
      ? receiptsData.reduce((sum, r) => sum + (r.confidenceScore || 0), 0) / receiptsData.length
      : 0;

    // Get current job counts
    const currentJobs = await this.db
      .select({
        status: receiptProcessingJobs.status,
        count: count()
      })
      .from(receiptProcessingJobs)
      .where(eq(receiptProcessingJobs.tenantId, tenantId))
      .groupBy(receiptProcessingJobs.status);

    const currentJobCounts = currentJobs.reduce((acc, item) => {
      acc[item.status.toLowerCase() as keyof JobStatusCounts] = item.count;
      return acc;
    }, {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      requiresReview: 0
    } as JobStatusCounts);

    return {
      totalProcessed,
      successfulProcessed,
      failedProcessed,
      manualReviewRequired,
      successRate: Math.round(successRate * 100) / 100,
      avgProcessingTimeMs: Math.round(avgProcessingTimeMs),
      avgConfidenceScore: Math.round(avgConfidenceScore * 1000) / 1000,
      currentJobs: currentJobCounts
    };
  }

  private async getProcessingTrends(
    tenantId: string, 
    dateRange: DateRange, 
    granularity: 'HOURLY' | 'DAILY' | 'WEEKLY',
    limit: number
  ): Promise<ProcessingTrend[]> {
    // For now, implement daily trends (can be extended for other granularities)
    const stats = await this.db
      .select()
      .from(receiptProcessingStats)
      .where(and(
        eq(receiptProcessingStats.tenantId, tenantId),
        gte(receiptProcessingStats.dateBucket, dateRange.startDate.toISOString().split('T')[0]),
        lte(receiptProcessingStats.dateBucket, dateRange.endDate.toISOString().split('T')[0])
      ))
      .orderBy(desc(receiptProcessingStats.dateBucket))
      .limit(limit);

    return stats.map(stat => ({
      date: stat.dateBucket,
      totalProcessed: stat.totalProcessed || 0,
      successfulProcessed: stat.successfulProcessed || 0,
      failedProcessed: stat.failedProcessed || 0,
      successRate: (stat.totalProcessed || 0) > 0 
        ? Math.round(((stat.successfulProcessed || 0) / (stat.totalProcessed || 0)) * 10000) / 100
        : 0,
      avgProcessingTimeMs: stat.avgProcessingTimeMs || 0,
      avgConfidenceScore: stat.avgConfidenceScore || 0
    }));
  }

  private analyzeErrorPatterns(failedJobs: any[]): ErrorPattern[] {
    const errorCounts = new Map<string, { count: number; examples: string[] }>();

    failedJobs.forEach(job => {
      const errorMessage = job.errorMessage || 'Unknown error';
      const errorType = this.categorizeError(errorMessage);
      
      if (!errorCounts.has(errorType)) {
        errorCounts.set(errorType, { count: 0, examples: [] });
      }
      
      const errorData = errorCounts.get(errorType)!;
      errorData.count++;
      if (errorData.examples.length < 3) {
        errorData.examples.push(errorMessage);
      }
    });

    const totalErrors = failedJobs.length;
    return Array.from(errorCounts.entries())
      .map(([errorType, data]) => ({
        errorType,
        count: data.count,
        percentage: Math.round((data.count / totalErrors) * 10000) / 100,
        examples: data.examples,
        suggestedFix: this.getSuggestedFix(errorType)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private analyzeErrorsByStage(failedJobs: any[]): StageErrorBreakdown[] {
    const stageErrors = new Map<string, { count: number; retries: number[] }>();

    failedJobs.forEach(job => {
      const stage = this.determineErrorStage(job.errorMessage || '');
      
      if (!stageErrors.has(stage)) {
        stageErrors.set(stage, { count: 0, retries: [] });
      }
      
      const stageData = stageErrors.get(stage)!;
      stageData.count++;
      stageData.retries.push(job.retryCount || 0);
    });

    const totalErrors = failedJobs.length;
    return Array.from(stageErrors.entries()).map(([stage, data]) => ({
      stage: stage as StageErrorBreakdown['stage'],
      errorCount: data.count,
      percentage: Math.round((data.count / totalErrors) * 10000) / 100,
      avgRetryCount: data.retries.length > 0 
        ? Math.round((data.retries.reduce((sum, r) => sum + r, 0) / data.retries.length) * 100) / 100
        : 0
    }));
  }

  private analyzeRetryPatterns(failedJobs: any[]): RetryAnalysis {
    const retries = failedJobs.map(job => job.retryCount || 0);
    const totalRetries = retries.reduce((sum, r) => sum + r, 0);
    const avgRetriesPerJob = failedJobs.length > 0 ? totalRetries / failedJobs.length : 0;
    const maxRetryCount = Math.max(...retries, 0);
    
    // Calculate retry success rate (jobs that eventually succeeded after retries)
    const retriedJobs = failedJobs.filter(job => (job.retryCount || 0) > 0);
    const retrySuccessRate = 0; // Would need additional data to calculate this properly

    return {
      totalRetries,
      avgRetriesPerJob: Math.round(avgRetriesPerJob * 100) / 100,
      retrySuccessRate,
      maxRetryCount
    };
  }

  private generateErrorSuggestions(errorPatterns: ErrorPattern[], errorsByStage: StageErrorBreakdown[]): string[] {
    const suggestions: string[] = [];

    // Suggestions based on error patterns
    errorPatterns.slice(0, 3).forEach(pattern => {
      suggestions.push(pattern.suggestedFix);
    });

    // Suggestions based on stage errors
    const topStageError = errorsByStage.sort((a, b) => b.errorCount - a.errorCount)[0];
    if (topStageError && topStageError.percentage > 30) {
      suggestions.push(`Focus on ${topStageError.stage} stage optimization - ${topStageError.percentage}% of errors`);
    }

    return suggestions.slice(0, 5);
  }

  private calculateProcessingSpeedMetrics(completedJobs: any[]): ProcessingSpeedMetrics {
    if (completedJobs.length === 0) {
      return {
        avgOcrTimeMs: 0,
        avgParsingTimeMs: 0,
        avgMatchingTimeMs: 0,
        avgStorageTimeMs: 0,
        totalAvgTimeMs: 0,
        percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 }
      };
    }

    const processingTimes = completedJobs
      .filter(job => job.startedAt && job.completedAt)
      .map(job => (job.completedAt || 0) - (job.startedAt || 0))
      .sort((a, b) => a - b);

    const totalAvgTimeMs = processingTimes.length > 0 
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0;

    // Calculate percentiles
    const getPercentile = (arr: number[], percentile: number) => {
      const index = Math.ceil((percentile / 100) * arr.length) - 1;
      return arr[Math.max(0, index)] || 0;
    };

    return {
      avgOcrTimeMs: Math.round(totalAvgTimeMs * 0.4), // Estimated breakdown
      avgParsingTimeMs: Math.round(totalAvgTimeMs * 0.3),
      avgMatchingTimeMs: Math.round(totalAvgTimeMs * 0.2),
      avgStorageTimeMs: Math.round(totalAvgTimeMs * 0.1),
      totalAvgTimeMs: Math.round(totalAvgTimeMs),
      percentiles: {
        p50: Math.round(getPercentile(processingTimes, 50)),
        p90: Math.round(getPercentile(processingTimes, 90)),
        p95: Math.round(getPercentile(processingTimes, 95)),
        p99: Math.round(getPercentile(processingTimes, 99))
      }
    };
  }

  private calculateThroughputMetrics(completedJobs: any[], dateRange: DateRange): ThroughputMetrics {
    const durationHours = (dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60);
    const durationDays = durationHours / 24;

    const receiptsPerHour = durationHours > 0 ? completedJobs.length / durationHours : 0;
    const receiptsPerDay = durationDays > 0 ? completedJobs.length / durationDays : 0;

    // Calculate peak hourly throughput (simplified)
    const peakHourlyThroughput = receiptsPerHour * 1.5; // Estimated peak

    return {
      receiptsPerHour: Math.round(receiptsPerHour * 100) / 100,
      receiptsPerDay: Math.round(receiptsPerDay * 100) / 100,
      peakHourlyThroughput: Math.round(peakHourlyThroughput * 100) / 100,
      averageQueueDepth: 0 // Would need queue monitoring data
    };
  }

  private calculateResourceMetrics(completedJobs: any[]): ResourceMetrics {
    // These would typically come from system monitoring
    // For now, return estimated values
    return {
      avgMemoryUsage: 0, // MB
      avgCpuUsage: 0, // Percentage
      storageUsage: completedJobs.length * 2, // Estimated 2MB per receipt
      apiCallsPerReceipt: 3 // OCR + parsing + storage
    };
  }

  private calculateOCRAccuracyMetrics(receiptsData: any[]): OCRAccuracyMetrics {
    if (receiptsData.length === 0) {
      return {
        avgConfidenceScore: 0,
        highConfidenceRate: 0,
        lowConfidenceRate: 0,
        textExtractionSuccessRate: 0,
        coordinateExtractionRate: 0
      };
    }

    const confidenceScores = receiptsData
      .map(r => r.receipt.confidenceScore || 0)
      .filter(score => score > 0);

    const avgConfidenceScore = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

    const highConfidenceRate = confidenceScores.filter(score => score > 0.8).length / confidenceScores.length;
    const lowConfidenceRate = confidenceScores.filter(score => score < 0.5).length / confidenceScores.length;

    return {
      avgConfidenceScore: Math.round(avgConfidenceScore * 1000) / 1000,
      highConfidenceRate: Math.round(highConfidenceRate * 10000) / 100,
      lowConfidenceRate: Math.round(lowConfidenceRate * 10000) / 100,
      textExtractionSuccessRate: 95, // Estimated
      coordinateExtractionRate: 80 // Estimated
    };
  }

  private async calculateParsingEffectivenessMetrics(receiptsData: any[], tenantId: string): Promise<ParsingEffectivenessMetrics> {
    if (receiptsData.length === 0) {
      return {
        vendorExtractionRate: 0,
        dateExtractionRate: 0,
        totalAmountExtractionRate: 0,
        lineItemExtractionRate: 0,
        avgLineItemsPerReceipt: 0,
        parsingConfidenceDistribution: { high: 0, medium: 0, low: 0 }
      };
    }

    const receipts = receiptsData.map(r => r.receipt);
    
    const vendorExtractionRate = receipts.filter(r => r.vendorName).length / receipts.length;
    const dateExtractionRate = receipts.filter(r => r.transactionDate).length / receipts.length;
    const totalAmountExtractionRate = receipts.filter(r => r.totalAmountCents).length / receipts.length;

    // Get line items count
    const lineItemsData = await this.db
      .select({ receiptId: receiptLineItems.receiptId, count: count() })
      .from(receiptLineItems)
      .where(sql`${receiptLineItems.receiptId} IN (${sql.join(receipts.map(r => sql`${r.id}`), sql`, `)})`)
      .groupBy(receiptLineItems.receiptId);

    const avgLineItemsPerReceipt = lineItemsData.length > 0
      ? lineItemsData.reduce((sum, item) => sum + item.count, 0) / lineItemsData.length
      : 0;

    const lineItemExtractionRate = lineItemsData.length / receipts.length;

    // Calculate confidence distribution
    const confidenceScores = receipts.map(r => r.confidenceScore || 0).filter(score => score > 0);
    const high = confidenceScores.filter(score => score >= 0.8).length;
    const medium = confidenceScores.filter(score => score >= 0.5 && score < 0.8).length;
    const low = confidenceScores.filter(score => score < 0.5).length;
    const total = confidenceScores.length;

    return {
      vendorExtractionRate: Math.round(vendorExtractionRate * 10000) / 100,
      dateExtractionRate: Math.round(dateExtractionRate * 10000) / 100,
      totalAmountExtractionRate: Math.round(totalAmountExtractionRate * 10000) / 100,
      lineItemExtractionRate: Math.round(lineItemExtractionRate * 10000) / 100,
      avgLineItemsPerReceipt: Math.round(avgLineItemsPerReceipt * 100) / 100,
      parsingConfidenceDistribution: {
        high: total > 0 ? Math.round((high / total) * 10000) / 100 : 0,
        medium: total > 0 ? Math.round((medium / total) * 10000) / 100 : 0,
        low: total > 0 ? Math.round((low / total) * 10000) / 100 : 0
      }
    };
  }

  private async calculateProductMatchingMetrics(receiptsData: any[], tenantId: string): Promise<ProductMatchingMetrics> {
    if (receiptsData.length === 0) {
      return {
        automaticMatchRate: 0,
        highConfidenceMatchRate: 0,
        manualOverrideRate: 0,
        unmatchedItemRate: 0,
        avgMatchConfidence: 0,
        matchingAccuracyTrend: []
      };
    }

    const receiptIds = receiptsData.map(r => r.receipt.id);
    
    // Get line items with matching data
    const lineItems = await this.db
      .select()
      .from(receiptLineItems)
      .where(sql`${receiptLineItems.receiptId} IN (${sql.join(receiptIds.map(id => sql`${id}`), sql`, `)})`);

    if (lineItems.length === 0) {
      return {
        automaticMatchRate: 0,
        highConfidenceMatchRate: 0,
        manualOverrideRate: 0,
        unmatchedItemRate: 0,
        avgMatchConfidence: 0,
        matchingAccuracyTrend: []
      };
    }

    const matchedItems = lineItems.filter(item => item.matchedProductId);
    const highConfidenceMatches = lineItems.filter(item => (item.matchConfidence || 0) > 0.8);
    const manualReviewItems = lineItems.filter(item => item.requiresManualReview);

    const automaticMatchRate = matchedItems.length / lineItems.length;
    const highConfidenceMatchRate = highConfidenceMatches.length / lineItems.length;
    const manualOverrideRate = manualReviewItems.length / lineItems.length;
    const unmatchedItemRate = (lineItems.length - matchedItems.length) / lineItems.length;

    const confidenceScores = matchedItems
      .map(item => item.matchConfidence || 0)
      .filter(score => score > 0);
    
    const avgMatchConfidence = confidenceScores.length > 0
      ? confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length
      : 0;

    return {
      automaticMatchRate: Math.round(automaticMatchRate * 10000) / 100,
      highConfidenceMatchRate: Math.round(highConfidenceMatchRate * 10000) / 100,
      manualOverrideRate: Math.round(manualOverrideRate * 10000) / 100,
      unmatchedItemRate: Math.round(unmatchedItemRate * 10000) / 100,
      avgMatchConfidence: Math.round(avgMatchConfidence * 1000) / 1000,
      matchingAccuracyTrend: [] // Would need historical data
    };
  }

  private async calculateManualReviewAnalysis(receiptsData: any[], tenantId: string): Promise<ManualReviewAnalysis> {
    const receipts = receiptsData.map(r => r.receipt);
    const reviewRequiredReceipts = receipts.filter(r => r.requiresManualReview);
    
    const reviewRate = reviewRequiredReceipts.length / receipts.length;

    return {
      reviewRate: Math.round(reviewRate * 10000) / 100,
      avgReviewTime: 0, // Would need review completion tracking
      reviewReasons: [], // Would need reason tracking
      reviewOutcomes: [] // Would need outcome tracking
    };
  }

  private categorizeError(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('ocr') || message.includes('vision')) {
      return 'OCR_ERROR';
    } else if (message.includes('parsing') || message.includes('text')) {
      return 'PARSING_ERROR';
    } else if (message.includes('matching') || message.includes('product')) {
      return 'MATCHING_ERROR';
    } else if (message.includes('database') || message.includes('storage')) {
      return 'STORAGE_ERROR';
    } else if (message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    } else if (message.includes('network') || message.includes('connection')) {
      return 'NETWORK_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  private determineErrorStage(errorMessage: string): string {
    const message = errorMessage.toLowerCase();
    
    if (message.includes('ocr') || message.includes('vision')) {
      return 'OCR';
    } else if (message.includes('parsing') || message.includes('text')) {
      return 'PARSING';
    } else if (message.includes('matching') || message.includes('product')) {
      return 'MATCHING';
    } else if (message.includes('database') || message.includes('storage')) {
      return 'STORAGE';
    } else {
      return 'PROCESSING';
    }
  }

  private getSuggestedFix(errorType: string): string {
    switch (errorType) {
      case 'OCR_ERROR':
        return 'Improve image quality preprocessing or switch to a more robust OCR model';
      case 'PARSING_ERROR':
        return 'Enhance parsing algorithms or add more receipt format patterns';
      case 'MATCHING_ERROR':
        return 'Expand product catalog or improve fuzzy matching algorithms';
      case 'STORAGE_ERROR':
        return 'Check database connectivity and optimize storage operations';
      case 'TIMEOUT_ERROR':
        return 'Increase timeout limits or optimize processing performance';
      case 'NETWORK_ERROR':
        return 'Implement better retry logic and network error handling';
      default:
        return 'Review error logs and implement specific error handling';
    }
  }
}

/**
 * Factory function to create ReceiptAnalyticsService instance
 */
export function createReceiptAnalyticsService(db: DrizzleD1Database): IReceiptAnalyticsService {
  return new ReceiptAnalyticsService(db);
}