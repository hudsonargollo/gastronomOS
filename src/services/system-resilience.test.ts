/**
 * Unit Tests for System Resilience Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  SystemResilienceService,
  DEFAULT_RETRY_CONFIG,
  PAYMENT_GATEWAY_RETRY_CONFIG,
  INVENTORY_RETRY_CONFIG
} from './system-resilience';

describe('SystemResilienceService', () => {
  let service: SystemResilienceService;

  beforeEach(() => {
    service = new SystemResilienceService();
    service.clearErrorLog();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-1'
      };

      const result = await service.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attemptsMade).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValue('success');

      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-1'
      };

      const result = await service.executeWithRetry(operation, context);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attemptsMade).toBe(3);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Persistent failure'));
      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-1'
      };

      const result = await service.executeWithRetry(operation, context, {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent failure');
      expect(result.attemptsMade).toBe(3); // Initial + 2 retries
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Non-retryable error');
      (error as any).code = 'NON_RETRYABLE';
      
      const operation = vi.fn().mockRejectedValue(error);
      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-1'
      };

      const result = await service.executeWithRetry(operation, context, {
        ...DEFAULT_RETRY_CONFIG,
        retryableErrors: ['RETRYABLE_ERROR']
      });

      expect(result.success).toBe(false);
      expect(result.attemptsMade).toBe(1);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Failure 1'))
        .mockRejectedValueOnce(new Error('Failure 2'))
        .mockResolvedValue('success');

      const context = {
        service: 'test-service',
        operation: 'test-operation',
        tenantId: 'tenant-1'
      };

      const startTime = Date.now();
      const result = await service.executeWithRetry(operation, context, {
        maxRetries: 2,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        backoffMultiplier: 2
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      // Should have waited at least 100ms + 200ms = 300ms
      expect(duration).toBeGreaterThanOrEqual(300);
    });
  });

  describe('executePaymentWithFallback', () => {
    it('should succeed without fallback', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true, paymentId: 'pay-123' });
      const context = {
        service: 'payment-gateway',
        operation: 'processPayment',
        tenantId: 'tenant-1'
      };

      const result = await service.executePaymentWithFallback(operation, context);

      expect(result.success).toBe(true);
      expect(result.fallbackRequired).toBe(false);
      expect(result.result).toEqual({ success: true, paymentId: 'pay-123' });
    });

    it('should indicate fallback required on failure', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Gateway unavailable'));
      const context = {
        service: 'payment-gateway',
        operation: 'processPayment',
        tenantId: 'tenant-1'
      };

      const result = await service.executePaymentWithFallback(operation, context);

      expect(result.success).toBe(false);
      expect(result.fallbackRequired).toBe(true);
      expect(result.fallbackReason).toContain('manual payment');
    });
  });

  describe('executeInventoryWithOverride', () => {
    it('should succeed without override', async () => {
      const operation = vi.fn().mockResolvedValue({ success: true, reservationId: 'res-123' });
      const context = {
        service: 'inventory-system',
        operation: 'reserveInventory',
        tenantId: 'tenant-1'
      };

      const result = await service.executeInventoryWithOverride(operation, context);

      expect(result.success).toBe(true);
      expect(result.overrideRequired).toBe(false);
      expect(result.result).toEqual({ success: true, reservationId: 'res-123' });
    });

    it('should indicate override required when allowed', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Inventory unavailable'));
      const context = {
        service: 'inventory-system',
        operation: 'reserveInventory',
        tenantId: 'tenant-1'
      };

      const result = await service.executeInventoryWithOverride(operation, context, true);

      expect(result.success).toBe(false);
      expect(result.overrideRequired).toBe(true);
      expect(result.overrideWarning).toContain('WARNING');
    });

    it('should not allow override when disabled', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Inventory unavailable'));
      const context = {
        service: 'inventory-system',
        operation: 'reserveInventory',
        tenantId: 'tenant-1'
      };

      const result = await service.executeInventoryWithOverride(operation, context, false);

      expect(result.success).toBe(false);
      expect(result.overrideRequired).toBe(false);
    });
  });

  describe('logError', () => {
    it('should log error with context', () => {
      service.logError({
        context: {
          service: 'test-service',
          operation: 'test-operation',
          tenantId: 'tenant-1'
        },
        error: 'Test error',
        errorCode: 'TEST_ERROR',
        severity: 'MEDIUM'
      });

      const errors = service.getRecentErrors(10);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toBe('Test error');
      expect(errors[0].errorCode).toBe('TEST_ERROR');
      expect(errors[0].severity).toBe('MEDIUM');
    });

    it('should maintain error log size limit', () => {
      // Log more than MAX_ERROR_LOG_SIZE errors
      for (let i = 0; i < 1100; i++) {
        service.logError({
          context: {
            service: 'test-service',
            operation: 'test-operation'
          },
          error: `Error ${i}`,
          severity: 'LOW'
        });
      }

      const errors = service.getRecentErrors(2000);
      expect(errors.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('getErrorStatistics', () => {
    it('should return correct statistics', () => {
      service.logError({
        context: { service: 'service-1', operation: 'op-1' },
        error: 'Error 1',
        severity: 'LOW'
      });

      service.logError({
        context: { service: 'service-1', operation: 'op-2' },
        error: 'Error 2',
        severity: 'HIGH'
      });

      service.logError({
        context: { service: 'service-2', operation: 'op-1' },
        error: 'Error 3',
        severity: 'HIGH'
      });

      const stats = service.getErrorStatistics();

      expect(stats.total).toBe(3);
      expect(stats.bySeverity.LOW).toBe(1);
      expect(stats.bySeverity.HIGH).toBe(2);
      expect(stats.byService['service-1']).toBe(2);
      expect(stats.byService['service-2']).toBe(1);
    });
  });

  describe('getErrorsByService', () => {
    it('should filter errors by service', () => {
      service.logError({
        context: { service: 'service-1', operation: 'op-1' },
        error: 'Error 1',
        severity: 'LOW'
      });

      service.logError({
        context: { service: 'service-2', operation: 'op-1' },
        error: 'Error 2',
        severity: 'LOW'
      });

      const errors = service.getErrorsByService('service-1');
      expect(errors).toHaveLength(1);
      expect(errors[0].context.service).toBe('service-1');
    });
  });

  describe('getErrorsByTenant', () => {
    it('should filter errors by tenant', () => {
      service.logError({
        context: { service: 'service-1', operation: 'op-1', tenantId: 'tenant-1' },
        error: 'Error 1',
        severity: 'LOW'
      });

      service.logError({
        context: { service: 'service-1', operation: 'op-1', tenantId: 'tenant-2' },
        error: 'Error 2',
        severity: 'LOW'
      });

      const errors = service.getErrorsByTenant('tenant-1');
      expect(errors).toHaveLength(1);
      expect(errors[0].context.tenantId).toBe('tenant-1');
    });
  });

  describe('getErrorsBySeverity', () => {
    it('should filter errors by severity', () => {
      service.logError({
        context: { service: 'service-1', operation: 'op-1' },
        error: 'Error 1',
        severity: 'LOW'
      });

      service.logError({
        context: { service: 'service-1', operation: 'op-2' },
        error: 'Error 2',
        severity: 'CRITICAL'
      });

      const criticalErrors = service.getErrorsBySeverity('CRITICAL');
      expect(criticalErrors).toHaveLength(1);
      expect(criticalErrors[0].severity).toBe('CRITICAL');
    });
  });
});
