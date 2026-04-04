/**
 * Property-based tests for ManualPaymentLogger service
 * **Validates: Requirements 6.1, 6.2, 6.3**
 * Feature: digital-menu-kitchen-payment-system, Property 13: Manual Payment Validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { ManualPaymentLogger, ManualPaymentErrorCode, type ManualPaymentRequest } from './manual-payment-logger';

describe('ManualPaymentLogger Property Tests', () => {
  let logger: ManualPaymentLogger;
  let mockDb: any;

  beforeEach(() => {
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

  /**
   * Property 13: Manual Payment Validation
   * For any manual payment entry, the system should require all mandatory fields 
   * (method, amount, reference) and validate that amounts match order totals.
   */
  it('Property 13: Manual Payment Validation - should validate all mandatory fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orderId: fc.oneof(fc.string({ minLength: 1 }), fc.constant('')),
          method: fc.oneof(
            fc.constantFrom('MANUAL_CARD', 'CASH'),
            fc.constantFrom('PIX', 'CREDIT_CARD', 'INVALID')
          ),
          amount: fc.integer({ min: -1000, max: 1000000 }),
          referenceNumber: fc.oneof(
            fc.string({ minLength: 3, maxLength: 50 }),
            fc.string({ minLength: 0, maxLength: 2 }),
            fc.string({ minLength: 51, maxLength: 100 })
          ),
          processedBy: fc.oneof(fc.string({ minLength: 1 }), fc.constant('')),
          notes: fc.option(fc.string())
        }),
        fc.string({ minLength: 1 }), // tenantId
        async (request, tenantId) => {
          const result = await logger.logPayment(tenantId, request as ManualPaymentRequest);

          // If any mandatory field is invalid, the request should fail
          const hasValidOrderId = request.orderId && request.orderId.length > 0;
          const hasValidMethod = ['MANUAL_CARD', 'CASH'].includes(request.method);
          const hasValidAmount = request.amount > 0;
          const hasValidReference = request.referenceNumber && 
            request.referenceNumber.length >= 3 && 
            request.referenceNumber.length <= 50;
          const hasValidProcessedBy = request.processedBy && request.processedBy.length > 0;

          const isValidRequest = hasValidOrderId && hasValidMethod && hasValidAmount && 
            hasValidReference && hasValidProcessedBy;

          if (!isValidRequest) {
            // Invalid requests should always fail with validation error
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
            expect(result.error).toBeDefined();
          }

          // Valid requests might still fail due to order not found, but not due to validation
          if (isValidRequest && !result.success) {
            expect(result.errorCode).not.toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Manual Payment Validation - should validate reference number format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string({ minLength: 1 }), // tenantId
        async (referenceNumber, tenantId) => {
          const request: ManualPaymentRequest = {
            orderId: 'valid-order-id',
            method: 'MANUAL_CARD',
            amount: 5000,
            referenceNumber,
            processedBy: 'valid-user-id',
            notes: 'Test payment'
          };

          const result = await logger.logPayment(tenantId, request);

          // Reference number must be between 3 and 50 characters
          const isValidLength = referenceNumber.length >= 3 && referenceNumber.length <= 50;
          const isNonEmpty = referenceNumber.trim().length > 0;

          if (!isValidLength || !isNonEmpty) {
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
            expect(result.error).toContain('Reference number');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Manual Payment Validation - should validate payment amounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -10000, max: 10000000 }),
        fc.string({ minLength: 1 }), // tenantId
        async (amount, tenantId) => {
          const request: ManualPaymentRequest = {
            orderId: 'valid-order-id',
            method: 'CASH',
            amount,
            referenceNumber: 'VALID-REF-123',
            processedBy: 'valid-user-id',
            notes: 'Test payment'
          };

          const result = await logger.logPayment(tenantId, request);

          // Amount must be greater than zero
          if (amount <= 0) {
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
            expect(result.error).toContain('greater than zero');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 13: Manual Payment Validation - should validate payment methods', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom('MANUAL_CARD', 'CASH'), // Valid methods
          fc.constantFrom('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'INVALID', '') // Invalid methods
        ),
        fc.string({ minLength: 1 }), // tenantId
        async (method, tenantId) => {
          const request: ManualPaymentRequest = {
            orderId: 'valid-order-id',
            method: method as any,
            amount: 5000,
            referenceNumber: 'VALID-REF-123',
            processedBy: 'valid-user-id',
            notes: 'Test payment'
          };

          const result = await logger.logPayment(tenantId, request);

          // Only MANUAL_CARD and CASH are valid for manual payments
          const isValidMethod = ['MANUAL_CARD', 'CASH'].includes(method);

          if (!isValidMethod) {
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(ManualPaymentErrorCode.VALIDATION_ERROR);
            expect(result.error).toMatch(/payment method/i);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 13: Manual Payment Validation - should handle empty or whitespace fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          orderId: fc.oneof(fc.string(), fc.constant(''), fc.constant('   ')),
          processedBy: fc.oneof(fc.string(), fc.constant(''), fc.constant('   ')),
          referenceNumber: fc.oneof(fc.string(), fc.constant(''), fc.constant('   '))
        }),
        fc.string({ minLength: 1 }), // tenantId
        async (fields, tenantId) => {
          const request: ManualPaymentRequest = {
            orderId: fields.orderId,
            method: 'MANUAL_CARD',
            amount: 5000,
            referenceNumber: fields.referenceNumber,
            processedBy: fields.processedBy,
            notes: 'Test payment'
          };

          const result = await logger.logPayment(tenantId, request);

          // Empty or whitespace-only required fields should cause validation failure
          const hasValidOrderId = fields.orderId && fields.orderId.trim().length > 0;
          const hasValidProcessedBy = fields.processedBy && fields.processedBy.trim().length > 0;
          const hasValidReference = fields.referenceNumber && 
            fields.referenceNumber.trim().length >= 3 &&
            fields.referenceNumber.trim().length <= 50;

          if (!hasValidOrderId || !hasValidProcessedBy || !hasValidReference) {
            expect(result.success).toBe(false);
            expect([
              ManualPaymentErrorCode.VALIDATION_ERROR,
              ManualPaymentErrorCode.ORDER_NOT_FOUND
            ]).toContain(result.errorCode);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});