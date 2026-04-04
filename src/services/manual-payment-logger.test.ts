/**
 * Unit tests for ManualPaymentLogger service
 * Tests manual payment logging functionality, validation, and audit trails
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ManualPaymentLogger, ManualPaymentErrorCode, type ManualPaymentRequest } from './manual-payment-logger';

// Mock database
const mockDb = {
  insert: vi.fn().mockReturnValue({ values: vi.fn() }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
        orderBy: vi.fn().mockResolvedValue([])
      })
    })
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({})
    })
  })
};

describe('ManualPaymentLogger', () => {
  let logger: ManualPaymentLogger;
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
    vi.clearAllMocks();
    logger = new ManualPaymentLogger(mockDb as any);
  });

  describe('logPayment', () => {
    it('should successfully log a valid manual payment', async () => {
      // Mock order exists and is in READY state
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 5000
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Payment + audit trail
    });

    it('should reject payment for non-existent order', async () => {
      // Mock order not found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.ORDER_NOT_FOUND);
      expect(result.error).toBe('Order not found');
    });

    it('should reject payment for cancelled order', async () => {
      // Mock cancelled order
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'CANCELLED',
              totalAmount: 5000
            }])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.INVALID_ORDER_STATE);
      expect(result.error).toContain('cancelled order');
    });

    it('should reject payment with invalid amount', async () => {
      const invalidRequest = {
        ...validRequest,
        amount: 0
      };

      const result = await logger.logPayment(tenantId, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
      expect(result.error).toContain('greater than zero');
    });

    it('should reject payment with missing reference number', async () => {
      const invalidRequest = {
        ...validRequest,
        referenceNumber: ''
      };

      const result = await logger.logPayment(tenantId, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
      expect(result.error).toContain('Reference number is required');
    });

    it('should reject payment with invalid payment method', async () => {
      const invalidRequest = {
        ...validRequest,
        method: 'PIX' as any
      };

      const result = await logger.logPayment(tenantId, invalidRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
      expect(result.error).toContain('Invalid payment method');
    });

    it('should reject payment with duplicate reference number', async () => {
      // Mock order exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 5000
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock duplicate reference found
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'existing-payment',
              gatewayTransactionId: validRequest.referenceNumber
            }])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.DUPLICATE_REFERENCE);
      expect(result.error).toContain('already been used');
    });

    it('should warn when payment amount differs from order total', async () => {
      // Mock order with different total
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 4500 // Different from payment amount
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(true);
      expect(result.validationResult?.warnings).toBeDefined();
      expect(result.validationResult?.warnings.some(w => w.includes('exceeds order total'))).toBe(true);
    });

    it('should mark order as delivered when payment completes the order', async () => {
      // Mock order exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 5000
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled(); // Order state update
      expect(mockDb.insert).toHaveBeenCalledTimes(3); // Payment + order transition + audit trail
    });

    it('should handle cash payments', async () => {
      const cashRequest = {
        ...validRequest,
        method: 'CASH' as const
      };

      // Mock order exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 5000
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, cashRequest);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBeDefined();
    });

    it('should handle partial payments correctly', async () => {
      // Mock order exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 10000 // 100.00
            }])
          })
        })
      });

      // Mock existing partial payment
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: 'existing-payment',
            amount: 3000, // 30.00 already paid
            status: 'COMPLETED'
          }])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const partialRequest = {
        ...validRequest,
        amount: 7000 // 70.00 - completes the payment
      };

      const result = await logger.logPayment(tenantId, partialRequest);

      expect(result.success).toBe(true);
      expect(result.validationResult?.warnings).toBeDefined();
      expect(result.validationResult?.warnings.some(w => w.includes('already has'))).toBe(true);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for an order', async () => {
      const mockPayments = [
        { id: 'payment-1', method: 'CASH', amount: 2500 },
        { id: 'payment-2', method: 'MANUAL_CARD', amount: 2500 }
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPayments)
          })
        })
      });

      const result = await logger.getPaymentHistory(tenantId, orderId);

      expect(result).toEqual(mockPayments);
      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('getAuditTrail', () => {
    it('should return audit trail for manual payments', async () => {
      const mockAuditEntries = [
        {
          id: 'audit-1',
          reason: 'MANUAL_PAYMENT_LOGGED',
          metadata: JSON.stringify({
            auditType: 'MANUAL_PAYMENT',
            paymentId: 'payment-1',
            method: 'CASH'
          })
        }
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAuditEntries)
          })
        })
      });

      const result = await logger.getAuditTrail(tenantId, orderId);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('MANUAL_PAYMENT_LOGGED');
    });

    it('should filter audit trail by payment ID', async () => {
      const mockAuditEntries = [
        {
          id: 'audit-1',
          reason: 'MANUAL_PAYMENT_LOGGED',
          metadata: JSON.stringify({
            auditType: 'MANUAL_PAYMENT',
            paymentId: 'payment-1'
          })
        },
        {
          id: 'audit-2',
          reason: 'MANUAL_PAYMENT_LOGGED',
          metadata: JSON.stringify({
            auditType: 'MANUAL_PAYMENT',
            paymentId: 'payment-2'
          })
        }
      ];

      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockAuditEntries)
          })
        })
      });

      const result = await logger.getAuditTrail(tenantId, orderId, 'payment-1');

      expect(result).toHaveLength(1);
      expect(JSON.parse(result[0].metadata).paymentId).toBe('payment-1');
    });
  });

  describe('validateConfiguration', () => {
    it('should validate manual payment logger configuration', async () => {
      const result = await logger.validateConfiguration(tenantId);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.select.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await logger.logPayment(tenantId, validRequest);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(ManualPaymentErrorCode.DATABASE_ERROR);
      expect(result.error).toContain('Database connection failed');
    });

    it('should validate reference number length', async () => {
      const shortRefRequest = {
        ...validRequest,
        referenceNumber: 'AB' // Too short
      };

      const result = await logger.logPayment(tenantId, shortRefRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should validate reference number maximum length', async () => {
      const longRefRequest = {
        ...validRequest,
        referenceNumber: 'A'.repeat(51) // Too long
      };

      const result = await logger.logPayment(tenantId, longRefRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('less than 50 characters');
    });

    it('should warn about unusually large payment amounts', async () => {
      const largeAmountRequest = {
        ...validRequest,
        amount: 50000000 // 500,000 reais
      };

      // Mock order exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: orderId,
              tenantId,
              state: 'READY',
              totalAmount: 50000000
            }])
          })
        })
      });

      // Mock no existing payments
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      // Mock no duplicate reference
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([])
          })
        })
      });

      const result = await logger.logPayment(tenantId, largeAmountRequest);

      expect(result.success).toBe(true);
      expect(result.validationResult?.warnings).toBeDefined();
      expect(result.validationResult?.warnings.some(w => w.includes('unusually large'))).toBe(true);
    });
  });
});