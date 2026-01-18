/**
 * Receipt Analytics Service Property-Based Tests
 * 
 * Property-based tests for the receipt analytics and monitoring system.
 * Feature: receipt-scanning, Property 10: Analytics and Monitoring
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { ReceiptAnalyticsService } from './receipt-analytics';

// Mock the entire schema module to avoid column reference issues
vi.mock('../db/schema', () => ({
  receiptProcessingJobs: {
    id: 'id',
    tenantId: 'tenant_id',
    userId: 'user_id',
    r2Key: 'r2_key',
    status: 'status',
    processingOptions: 'processing_options',
    createdAt: 'created_at',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    retryCount: 'retry_count',
    errorMessage: 'error_message'
  },
  receipts: {
    id: 'id',
    tenantId: 'tenant_id',
    processingJobId: 'processing_job_id',
    r2Key: 'r2_key',
    vendorName: 'vendor_name',
    transactionDate: 'transaction_date',
    totalAmountCents: 'total_amount_cents',
    subtotalCents: 'subtotal_cents',
    taxCents: 'tax_cents',
    currency: 'currency',
    confidenceScore: 'confidence_score',
    requiresManualReview: 'requires_manual_review',
    linkedPoId: 'linked_po_id',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  receiptLineItems: {
    id: 'id',
    receiptId: 'receipt_id',
    description: 'description',
    quantity: 'quantity',
    unitPriceCents: 'unit_price_cents',
    totalPriceCents: 'total_price_cents',
    matchedProductId: 'matched_product_id',
    matchConfidence: 'match_confidence',
    requiresManualReview: 'requires_manual_review',
    rawText: 'raw_text',
    coordinates: 'coordinates',
    createdAt: 'created_at'
  },
  receiptProcessingStats: {
    id: 'id',
    tenantId: 'tenant_id',
    dateBucket: 'date_bucket',
    totalProcessed: 'total_processed',
    successfulProcessed: 'successful_processed',
    failedProcessed: 'failed_processed',
    manualReviewRequired: 'manual_review_required',
    avgProcessingTimeMs: 'avg_processing_time_ms',
    avgConfidenceScore: 'avg_confidence_score',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  },
  productMatchCandidates: {
    id: 'id',
    receiptLineItemId: 'receipt_line_item_id',
    productId: 'product_id',
    similarityScore: 'similarity_score',
    matchType: 'match_type',
    confidence: 'confidence',
    createdAt: 'created_at'
  },
  products: {
    id: 'id',
    name: 'name',
    sku: 'sku',
    description: 'description'
  },
  ReceiptProcessingStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REQUIRES_REVIEW: 'REQUIRES_REVIEW'
  }
}));

// Mock Drizzle ORM functions
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column, value) => ({ column, value, type: 'eq' })),
  and: vi.fn((...conditions) => ({ conditions, type: 'and' })),
  gte: vi.fn((column, value) => ({ column, value, type: 'gte' })),
  lte: vi.fn((column, value) => ({ column, value, type: 'lte' })),
  desc: vi.fn((column) => ({ column, type: 'desc' })),
  sql: {
    join: vi.fn((items, separator) => ({ items, separator, type: 'join' }))
  },
  count: vi.fn(() => ({ type: 'count' })),
  sum: vi.fn((column) => ({ column, type: 'sum' })),
  avg: vi.fn((column) => ({ column, type: 'avg' }))
}));

// Mock database for testing
const createMockDb = () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  };

  // Create a reusable query chain mock that properly handles all method chaining
  const createQueryChain = (result: any) => {
    const chain = {
      select: vi.fn(),
      from: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn(),
      groupBy: vi.fn(),
      innerJoin: vi.fn(),
      onConflictDoUpdate: vi.fn(),
      values: vi.fn()
    };

    // Make all methods return the chain itself for proper chaining
    Object.keys(chain).forEach(method => {
      chain[method as keyof typeof chain].mockReturnValue(chain);
    });

    // Override specific methods to return promises when they're the final call
    chain.where.mockResolvedValue(result);
    chain.limit.mockResolvedValue(result);
    chain.groupBy.mockResolvedValue(result);
    chain.orderBy.mockResolvedValue(result);
    chain.onConflictDoUpdate.mockResolvedValue(result);

    return chain;
  };

  return { mockDb, createQueryChain };
};

const { mockDb, createQueryChain } = createMockDb();

// Test data generators
const generateTenantId = () => fc.string({ minLength: 8, maxLength: 32 });
const generateDateRange = () => fc.record({
  startDate: fc.date({ min: new Date('2022-01-01'), max: new Date() }),
  endDate: fc.date({ min: new Date('2022-01-01'), max: new Date() })
}).filter(range => range.startDate <= range.endDate);

const generateProcessingJob = () => fc.record({
  id: fc.string({ minLength: 16, maxLength: 64 }),
  tenantId: fc.string({ minLength: 8, maxLength: 32 }),
  userId: fc.string({ minLength: 8, maxLength: 32 }),
  r2Key: fc.string({ minLength: 10, maxLength: 100 }),
  status: fc.constantFrom('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REQUIRES_REVIEW'),
  processingOptions: fc.option(fc.object()),
  createdAt: fc.integer({ min: 1640995200000, max: Date.now() }),
  startedAt: fc.option(fc.integer({ min: 1640995200000, max: Date.now() })),
  completedAt: fc.option(fc.integer({ min: 1640995200000, max: Date.now() })),
  retryCount: fc.integer({ min: 0, max: 5 }),
  errorMessage: fc.option(fc.string({ minLength: 10, maxLength: 200 }))
});

describe('Receipt Analytics Service - Property-Based Tests', () => {
  let analyticsService: ReceiptAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    analyticsService = new ReceiptAnalyticsService(mockDb as unknown as DrizzleD1Database);
  });

  describe('Property 10: Analytics and Monitoring', () => {
    /**
     * Feature: receipt-scanning, Property 10: Analytics and Monitoring
     * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
     * 
     * Property: For any receipt processing activity, the system should collect 
     * comprehensive metrics including success rates, processing times, and accuracy statistics.
     */
    it('should collect comprehensive metrics for any processing activity', async () => {
      await fc.assert(fc.asyncProperty(
        generateTenantId(),
        generateDateRange(),
        fc.array(generateProcessingJob(), { minLength: 1, maxLength: 20 }),
        async (tenantId, dateRange, jobs) => {
          // Set up mock responses for different database queries
          let queryCount = 0;
          
          mockDb.select.mockImplementation(() => {
            queryCount++;
            
            if (queryCount === 1) {
              // First query: get processing jobs
              return createQueryChain(jobs);
            } else if (queryCount === 2) {
              // Second query: get receipts with confidence scores
              const mockReceipts = jobs.slice(0, Math.min(5, jobs.length)).map(() => ({
                confidenceScore: Math.random() * 0.5 + 0.5 // 0.5-1.0
              }));
              return createQueryChain(mockReceipts);
            } else if (queryCount === 3) {
              // Third query: get current job status counts
              const statusCounts = [
                { status: 'COMPLETED', count: jobs.filter(j => j.status === 'COMPLETED').length },
                { status: 'FAILED', count: jobs.filter(j => j.status === 'FAILED').length },
                { status: 'PENDING', count: jobs.filter(j => j.status === 'PENDING').length },
                { status: 'PROCESSING', count: jobs.filter(j => j.status === 'PROCESSING').length },
                { status: 'REQUIRES_REVIEW', count: jobs.filter(j => j.status === 'REQUIRES_REVIEW').length }
              ];
              
              // Create a special chain for the groupBy query
              const chain = {
                select: vi.fn().mockReturnThis(),
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                groupBy: vi.fn().mockResolvedValue(statusCounts),
                innerJoin: vi.fn().mockReturnThis(),
                onConflictDoUpdate: vi.fn().mockReturnThis(),
                values: vi.fn().mockReturnThis()
              };
              
              return chain;
            } else if (queryCount === 4) {
              // Fourth query: get processing trends (receiptProcessingStats)
              const mockStats = [];
              // Create a special chain for the orderBy/limit query
              const chain = {
                select: vi.fn().mockReturnThis(),
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue(mockStats),
                groupBy: vi.fn().mockReturnThis(),
                innerJoin: vi.fn().mockReturnThis(),
                onConflictDoUpdate: vi.fn().mockReturnThis(),
                values: vi.fn().mockReturnThis()
              };
              
              return chain;
            } else {
              // Additional queries return empty results
              return createQueryChain([]);
            }
          });

          try {
            const analytics = await analyticsService.getProcessingAnalytics(tenantId, dateRange);

            // Verify analytics structure is comprehensive
            expect(analytics).toHaveProperty('summary');
            expect(analytics).toHaveProperty('trends');
            expect(analytics).toHaveProperty('errorAnalysis');
            expect(analytics).toHaveProperty('performanceMetrics');
            expect(analytics).toHaveProperty('qualityMetrics');

            // Verify summary contains all required metrics
            const { summary } = analytics;
            expect(summary).toHaveProperty('totalProcessed');
            expect(summary).toHaveProperty('successfulProcessed');
            expect(summary).toHaveProperty('failedProcessed');
            expect(summary).toHaveProperty('manualReviewRequired');
            expect(summary).toHaveProperty('successRate');
            expect(summary).toHaveProperty('avgProcessingTimeMs');
            expect(summary).toHaveProperty('avgConfidenceScore');
            expect(summary).toHaveProperty('currentJobs');

            // Verify metrics are mathematically consistent
            expect(summary.totalProcessed).toBeGreaterThanOrEqual(0);
            expect(summary.successfulProcessed).toBeGreaterThanOrEqual(0);
            expect(summary.failedProcessed).toBeGreaterThanOrEqual(0);
            expect(summary.manualReviewRequired).toBeGreaterThanOrEqual(0);
            
            // Success rate should be between 0 and 100
            expect(summary.successRate).toBeGreaterThanOrEqual(0);
            expect(summary.successRate).toBeLessThanOrEqual(100);
            
            // Processing time should be non-negative
            expect(summary.avgProcessingTimeMs).toBeGreaterThanOrEqual(0);
            
            // Confidence score should be between 0 and 1
            expect(summary.avgConfidenceScore).toBeGreaterThanOrEqual(0);
            expect(summary.avgConfidenceScore).toBeLessThanOrEqual(1);

            // Verify error analysis structure
            expect(analytics.errorAnalysis).toHaveProperty('commonErrors');
            expect(analytics.errorAnalysis).toHaveProperty('errorsByStage');
            expect(analytics.errorAnalysis).toHaveProperty('retryAnalysis');
            expect(analytics.errorAnalysis).toHaveProperty('suggestions');
            
            // Verify arrays are present
            expect(Array.isArray(analytics.errorAnalysis.commonErrors)).toBe(true);
            expect(Array.isArray(analytics.errorAnalysis.errorsByStage)).toBe(true);
            expect(Array.isArray(analytics.errorAnalysis.suggestions)).toBe(true);

            // Verify performance metrics structure
            expect(analytics.performanceMetrics).toHaveProperty('processingSpeed');
            expect(analytics.performanceMetrics).toHaveProperty('throughput');
            expect(analytics.performanceMetrics).toHaveProperty('resourceUtilization');
            expect(analytics.performanceMetrics).toHaveProperty('bottlenecks');

            // Verify quality metrics structure
            expect(analytics.qualityMetrics).toHaveProperty('ocrAccuracy');
            expect(analytics.qualityMetrics).toHaveProperty('parsingEffectiveness');
            expect(analytics.qualityMetrics).toHaveProperty('productMatching');
            expect(analytics.qualityMetrics).toHaveProperty('manualReviewAnalysis');

          } catch (error) {
            // Analytics should handle errors gracefully and still return structured data
            // For this property test, we expect the service to be robust
            throw error; // Re-throw to fail the test if there are unexpected errors
          }
        }
      ), { numRuns: 100 });
    });

    it('should maintain consistent success rate calculations across different job distributions', async () => {
      await fc.assert(fc.asyncProperty(
        generateTenantId(),
        generateDateRange(),
        fc.array(generateProcessingJob(), { minLength: 5, maxLength: 15 }),
        async (tenantId, dateRange, jobs) => {
          // Ensure we have a predictable mix of job statuses
          const modifiedJobs = jobs.map((job, index) => ({
            ...job,
            status: index % 3 === 0 ? 'COMPLETED' : 
                   index % 3 === 1 ? 'FAILED' : 
                   'REQUIRES_REVIEW',
            startedAt: job.createdAt + 1000,
            completedAt: job.createdAt + 5000
          }));

          // Set up mock responses for different database queries
          let queryCount = 0;
          
          mockDb.select.mockImplementation(() => {
            queryCount++;
            
            if (queryCount === 1) {
              // First query: get processing jobs
              return createQueryChain(modifiedJobs);
            } else if (queryCount === 2) {
              // Second query: get receipts with confidence scores
              const mockReceipts = modifiedJobs.slice(0, Math.min(3, modifiedJobs.length)).map(() => ({
                confidenceScore: Math.random() * 0.4 + 0.6 // 0.6-1.0
              }));
              return createQueryChain(mockReceipts);
            } else if (queryCount === 3) {
              // Third query: get current job status counts
              const statusCounts = [
                { status: 'COMPLETED', count: modifiedJobs.filter(j => j.status === 'COMPLETED').length },
                { status: 'FAILED', count: modifiedJobs.filter(j => j.status === 'FAILED').length },
                { status: 'REQUIRES_REVIEW', count: modifiedJobs.filter(j => j.status === 'REQUIRES_REVIEW').length }
              ];
              
              // Create a special chain for the groupBy query
              const chain = {
                select: vi.fn().mockReturnThis(),
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockReturnThis(),
                groupBy: vi.fn().mockResolvedValue(statusCounts),
                innerJoin: vi.fn().mockReturnThis(),
                onConflictDoUpdate: vi.fn().mockReturnThis(),
                values: vi.fn().mockReturnThis()
              };
              
              return chain;
            } else if (queryCount === 4) {
              // Fourth query: get processing trends (receiptProcessingStats)
              const mockStats = [];
              // Create a special chain for the orderBy/limit query
              const chain = {
                select: vi.fn().mockReturnThis(),
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                orderBy: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue(mockStats),
                groupBy: vi.fn().mockReturnThis(),
                innerJoin: vi.fn().mockReturnThis(),
                onConflictDoUpdate: vi.fn().mockReturnThis(),
                values: vi.fn().mockReturnThis()
              };
              
              return chain;
            } else {
              return createQueryChain([]);
            }
          });

          const analytics = await analyticsService.getProcessingAnalytics(tenantId, dateRange);

          // Calculate expected success rate
          const completedJobs = modifiedJobs.filter(j => j.status === 'COMPLETED');
          const expectedSuccessRate = modifiedJobs.length > 0 ? 
            (completedJobs.length / modifiedJobs.length) * 100 : 0;

          // Verify success rate calculation is consistent
          expect(analytics.summary.totalProcessed).toBe(modifiedJobs.length);
          expect(analytics.summary.successfulProcessed).toBe(completedJobs.length);
          expect(Math.abs(analytics.summary.successRate - expectedSuccessRate)).toBeLessThan(0.01);
        }
      ), { numRuns: 50 });
    });

    it('should generate improvement suggestions based on any analytics data patterns', async () => {
      await fc.assert(fc.asyncProperty(
        generateTenantId(),
        generateDateRange(),
        async (tenantId, dateRange) => {
          // Mock empty data scenario - all queries return empty results
          mockDb.select.mockImplementation(() => {
            return createQueryChain([]);
          });

          const suggestions = await analyticsService.generateImprovementSuggestions(tenantId, dateRange);

          // Verify suggestions are always provided
          expect(Array.isArray(suggestions)).toBe(true);
          expect(suggestions.length).toBeGreaterThan(0);
          expect(suggestions.length).toBeLessThanOrEqual(5); // Should limit to top 5

          // Verify all suggestions are strings
          suggestions.forEach(suggestion => {
            expect(typeof suggestion).toBe('string');
            expect(suggestion.length).toBeGreaterThan(0);
          });
        }
      ), { numRuns: 30 });
    });

    it('should maintain data consistency when updating processing statistics', async () => {
      await fc.assert(fc.asyncProperty(
        generateTenantId(),
        fc.date({ min: new Date('2022-01-01'), max: new Date() }),
        fc.array(generateProcessingJob(), { minLength: 1, maxLength: 10 }),
        async (tenantId, date, jobs) => {
          // Set up mock responses for different database queries
          let queryCount = 0;
          
          mockDb.select.mockImplementation(() => {
            queryCount++;
            
            if (queryCount === 1) {
              // First query: get processing jobs for the day
              return createQueryChain(jobs);
            } else if (queryCount === 2) {
              // Second query: get receipts with confidence scores
              const mockReceipts = jobs.slice(0, Math.min(3, jobs.length)).map(() => ({
                confidenceScore: Math.random() * 0.5 + 0.5 // 0.5-1.0
              }));
              return createQueryChain(mockReceipts);
            } else {
              return createQueryChain([]);
            }
          });

          // Mock insert operations
          mockDb.insert.mockImplementation(() => {
            return createQueryChain(undefined);
          });

          await analyticsService.updateProcessingStats(tenantId, date);

          // Verify database operations were called
          expect(mockDb.select).toHaveBeenCalled();
          expect(mockDb.insert).toHaveBeenCalled();

          // The method should complete without throwing errors
          // This tests that the statistics update process is robust
        }
      ), { numRuns: 30 });
    });
  });
});