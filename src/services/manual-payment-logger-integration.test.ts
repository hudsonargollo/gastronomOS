/**
 * Integration tests for ManualPaymentLogger service
 * Tests the service with a more realistic database mock
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManualPaymentLogger, ManualPaymentErrorCode, type ManualPaymentRequest } from './manual-payment-logger';

describe('ManualPaymentLogger Integration Tests', () => {
  let logger: ManualPaymentLogger;
  let mockDb: any;

  const tenantId = 'tenant-123';
  const orderId = 'order-456';
  const processedBy = 'user-789';

  const validRequest: ManualPaymentRequest = {
    orderId,
    method: 'MANUAL_CARD',
    amount: 5000, // 50.00 in cents
    referenceNumber: 'REF123456',
    processedBy,
    notes: 'External card machine payment'
  };

  beforeEach(() => {
    // Create a more realistic mock database
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      })
    };

    logger = new ManualPaymentLogger(mockDb);
  });

  it('should validate payment request correctly', async () => {
    // Test invalid amount
    const invalidAmountRequest = { ...validRequest, amount: 0 };
    const result1 = await logger.logPayment(tenantId, invalidAmountRequest);
    
    expect(result1.success).toBe(false);
    expect(result1.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
    expect(result1.error).toContain('greater than zero');

    // Test missing reference number
    const invalidRefRequest = { ...validRequest, referenceNumber: '' };
    const result2 = await logger.logPayment(tenantId, invalidRefRequest);
    
    expect(result2.success).toBe(false);
    expect(result2.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
    expect(result2.error).toContain('Reference number is required');

    // Test invalid payment method
    const invalidMethodRequest = { ...validRequest, method: 'PIX' as any };
    const result3 = await logger.logPayment(tenantId, invalidMethodRequest);
    
    expect(result3.success).toBe(false);
    expect(result3.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
    expect(result3.error).toContain('Invalid payment method');
  });

  it('should handle order not found', async () => {
    // Mock order not found
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]) // Empty array = order not found
        })
      })
    });

    const result = await logger.logPayment(tenantId, validRequest);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ManualPaymentErrorCode.ORDER_NOT_FOUND);
    expect(result.error).toBe('Order not found');
  });

  it('should validate reference number length', async () => {
    // Test too short reference number
    const shortRefRequest = { ...validRequest, referenceNumber: 'AB' };
    const result1 = await logger.logPayment(tenantId, shortRefRequest);
    
    expect(result1.success).toBe(false);
    expect(result1.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
    expect(result1.error).toContain('between 3 and 50 characters');

    // Test too long reference number
    const longRefRequest = { ...validRequest, referenceNumber: 'A'.repeat(51) };
    const result2 = await logger.logPayment(tenantId, longRefRequest);
    
    expect(result2.success).toBe(false);
    expect(result2.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
    expect(result2.error).toContain('between 3 and 50 characters');
  });

  it('should handle database errors gracefully', async () => {
    // Mock database error
    mockDb.select.mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    const result = await logger.logPayment(tenantId, validRequest);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ManualPaymentErrorCode.DATABASE_ERROR);
    expect(result.error).toContain('Database error occurred');
  });

  it('should validate configuration', async () => {
    // Mock successful database connection test
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([])
      })
    });

    const result = await logger.validateConfiguration(tenantId);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should handle configuration validation failure', async () => {
    // Mock database connection failure
    mockDb.select.mockImplementation(() => {
      throw new Error('Connection failed');
    });

    const result = await logger.validateConfiguration(tenantId);

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(ManualPaymentErrorCode.DATABASE_ERROR);
    expect(result.error).toContain('Database connection failed');
  });

  it('should create payment summary correctly', async () => {
    // Mock order exists
    const mockOrder = {
      id: orderId,
      tenantId,
      state: 'READY',
      totalAmount: 5000
    };

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder])
          })
        })
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]) // No existing payments
        })
      });

    const result = await logger.getPaymentSummary(tenantId, orderId);

    expect(result).toBeDefined();
    expect(result?.orderId).toBe(orderId);
    expect(result?.orderTotal).toBe(5000);
    expect(result?.totalPaid).toBe(0);
    expect(result?.remainingAmount).toBe(5000);
    expect(result?.isFullyPaid).toBe(false);
  });

  it('should return null for non-existent order in payment summary', async () => {
    // Mock order not found
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([])
        })
      })
    });

    const result = await logger.getPaymentSummary(tenantId, 'non-existent-order');

    expect(result).toBeNull();
  });
});