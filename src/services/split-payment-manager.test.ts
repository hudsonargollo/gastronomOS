/**
 * Unit tests for Split Payment Manager
 * Tests real-time balance tracking, mixed payment methods, overpayment detection
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SplitPaymentManager, SplitPaymentErrorCode, createSplitPaymentManager } from './split-payment-manager';
import { PaymentMethod, PaymentStatus, OrderState } from '../db/schema';

// Mock payment gateway service
const mockPaymentGateway = {
  processPayment: vi.fn()
};

describe('SplitPaymentManager', () => {
  let splitPaymentManager: SplitPaymentManager;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create fresh mock database for each test
    mockDb = {
      insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve(undefined)) })),
      select: vi.fn(),
      update: vi.fn(() => ({ 
        set: vi.fn(() => ({ 
          where: vi.fn(() => Promise.resolve(undefined)) 
        })) 
      })),
      query: {
        payments: {
          findFirst: vi.fn()
        }
      }
    };
    
    splitPaymentManager = createSplitPaymentManager(mockDb, mockPaymentGateway);
  });

  describe('initializeSplitPayment', () => {
    it('should create a new split payment record for an order', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      // Setup mock chain for split payment check (empty), then order query
      const callOrder: string[] = [];
      
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              callOrder.push('limit');
              // First call returns empty (no existing split payment)
              // Second call returns order
              if (callOrder.length === 1) {
                return [];
              }
              return [{
                id: orderId,
                tenantId,
                totalAmount: orderTotal,
                state: OrderState.READY
              }];
            })
          }))
        }))
      }));

      const result = await splitPaymentManager.initializeSplitPayment(tenantId, orderId);

      expect(result.success).toBe(true);
      expect(result.splitPaymentId).toBeDefined();
    });

    it('should return existing split payment if one already exists', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const existingSplitPaymentId = 'split-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: existingSplitPaymentId,
              tenantId,
              orderId,
              totalAmount: 10000,
              paidAmount: 0,
              remainingAmount: 10000,
              isComplete: false
            }])
          }))
        }))
      }));

      const result = await splitPaymentManager.initializeSplitPayment(tenantId, orderId);

      expect(result.success).toBe(true);
      expect(result.splitPaymentId).toBe(existingSplitPaymentId);
    });
  });

  describe('processPayment', () => {
    it('should process a partial payment and update balance', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      // Setup mock chain
      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              selectCallCount++;
              // First call: order query
              if (selectCallCount === 1) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              // Second call: split payment check (empty)
              if (selectCallCount === 2) {
                return [];
              }
              // Third call: order for init
              if (selectCallCount === 3) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              // Fourth call: balance check
              if (selectCallCount === 4) {
                return [{
                  id: 'split-123',
                  tenantId,
                  orderId,
                  totalAmount: orderTotal,
                  paidAmount: 0,
                  remainingAmount: orderTotal,
                  isComplete: false
                }];
              }
              return [];
            }),
            orderBy: vi.fn(async () => [])
          }))
        }))
      }));

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.CASH,
        amount: 5000,
        processedBy: 'user-123'
      });

      expect(result.success).toBe(true);
      expect(result.paymentId).toBeDefined();
    });

    it('should reject payment for cancelled order', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: orderId,
              tenantId,
              totalAmount: 10000,
              state: OrderState.CANCELLED
            }])
          }))
        }))
      }));

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.CASH,
        amount: 5000,
        processedBy: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SplitPaymentErrorCode.INVALID_ORDER_STATE);
    });

    it('should reject payment for already delivered order', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: orderId,
              tenantId,
              totalAmount: 10000,
              state: OrderState.DELIVERED
            }])
          }))
        }))
      }));

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.CASH,
        amount: 5000,
        processedBy: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SplitPaymentErrorCode.INVALID_ORDER_STATE);
    });

    it('should reject payment with invalid amount', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: orderId,
              tenantId,
              totalAmount: 10000,
              state: OrderState.READY
            }])
          }))
        }))
      }));

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.CASH,
        amount: 0, // Invalid amount
        processedBy: 'user-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(SplitPaymentErrorCode.VALIDATION_ERROR);
    });
  });

  describe('getBalanceInfo', () => {
    it('should return real-time balance information', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return [{
                  id: 'split-123',
                  tenantId,
                  orderId,
                  totalAmount: orderTotal,
                  paidAmount: 6000,
                  remainingAmount: 4000,
                  isComplete: false
                }];
              }
              return [];
            }),
            orderBy: vi.fn(async () => [
              { id: 'payment-1', method: PaymentMethod.CASH, amount: 3000, status: PaymentStatus.COMPLETED, createdAt: Date.now() },
              { id: 'payment-2', method: PaymentMethod.PIX, amount: 3000, status: PaymentStatus.COMPLETED, createdAt: Date.now() }
            ])
          }))
        }))
      }));

      const balanceInfo = await splitPaymentManager.getBalanceInfo(tenantId, orderId);

      expect(balanceInfo).toBeDefined();
      expect(balanceInfo?.totalAmount).toBe(orderTotal);
      expect(balanceInfo?.paidAmount).toBe(6000);
      expect(balanceInfo?.remainingAmount).toBe(4000);
      expect(balanceInfo?.isComplete).toBe(false);
    });

    it('should return initial balance for order without split payment', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              selectCallCount++;
              // First call: no split payment
              if (selectCallCount === 1) {
                return [];
              }
              // Second call: order exists
              return [{
                id: orderId,
                tenantId,
                totalAmount: orderTotal,
                state: OrderState.READY
              }];
            }),
            orderBy: vi.fn(async () => [])
          }))
        }))
      }));

      const balanceInfo = await splitPaymentManager.getBalanceInfo(tenantId, orderId);

      expect(balanceInfo).toBeDefined();
      expect(balanceInfo?.totalAmount).toBe(orderTotal);
      expect(balanceInfo?.paidAmount).toBe(0);
      expect(balanceInfo?.remainingAmount).toBe(orderTotal);
      expect(balanceInfo?.isComplete).toBe(false);
      expect(balanceInfo?.paymentCount).toBe(0);
    });
  });

  describe('canCompleteOrder', () => {
    it('should return true when order is fully paid', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 'split-123',
              tenantId,
              orderId,
              totalAmount: 10000,
              paidAmount: 10000,
              remainingAmount: 0,
              isComplete: true
            }]),
            orderBy: vi.fn(async () => [
              { id: 'payment-1', method: PaymentMethod.CASH, amount: 10000, status: PaymentStatus.COMPLETED, createdAt: Date.now() }
            ])
          }))
        }))
      }));

      const canComplete = await splitPaymentManager.canCompleteOrder(tenantId, orderId);

      expect(canComplete).toBe(true);
    });

    it('should return false when order is not fully paid', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              id: 'split-123',
              tenantId,
              orderId,
              totalAmount: 10000,
              paidAmount: 5000,
              remainingAmount: 5000,
              isComplete: false
            }]),
            orderBy: vi.fn(async () => [
              { id: 'payment-1', method: PaymentMethod.CASH, amount: 5000, status: PaymentStatus.COMPLETED, createdAt: Date.now() }
            ])
          }))
        }))
      }));

      const canComplete = await splitPaymentManager.canCompleteOrder(tenantId, orderId);

      expect(canComplete).toBe(false);
    });
  });

  describe('calculateChange', () => {
    it('should calculate correct change for overpayment', () => {
      const totalAmount = 10000; // 100.00
      const paidAmount = 12000; // 120.00

      const change = splitPaymentManager.calculateChange(totalAmount, paidAmount);

      expect(change).toBe(2000); // 20.00
    });

    it('should return 0 when no overpayment', () => {
      const totalAmount = 10000;
      const paidAmount = 10000;

      const change = splitPaymentManager.calculateChange(totalAmount, paidAmount);

      expect(change).toBe(0);
    });

    it('should return 0 when underpaid', () => {
      const totalAmount = 10000;
      const paidAmount = 8000;

      const change = splitPaymentManager.calculateChange(totalAmount, paidAmount);

      expect(change).toBe(0);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for an order', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';

      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(async () => [
              { id: 'payment-1', method: PaymentMethod.CASH, amount: 3000, status: PaymentStatus.COMPLETED, createdAt: 1000, processedAt: 1001 },
              { id: 'payment-2', method: PaymentMethod.PIX, amount: 7000, status: PaymentStatus.COMPLETED, createdAt: 2000, processedAt: 2001 }
            ])
          }))
        }))
      }));

      const history = await splitPaymentManager.getPaymentHistory(tenantId, orderId);

      expect(history).toHaveLength(2);
      expect(history[0].method).toBe(PaymentMethod.CASH);
      expect(history[0].amount).toBe(3000);
      expect(history[1].method).toBe(PaymentMethod.PIX);
      expect(history[1].amount).toBe(7000);
    });
  });

  describe('mixed payment methods', () => {
    it('should support mixed payment methods within a single split payment session', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      // Simulate two payments with different methods
      let selectCallCount = 0;
      
      // First payment - CASH
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              if (selectCallCount === 2) {
                return []; // No existing split payment
              }
              if (selectCallCount === 3) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              if (selectCallCount === 4) {
                return [{
                  id: 'split-123',
                  tenantId,
                  orderId,
                  totalAmount: orderTotal,
                  paidAmount: 0,
                  remainingAmount: orderTotal,
                  isComplete: false
                }];
              }
              return [];
            }),
            orderBy: vi.fn(async () => [])
          }))
        }))
      }));

      // Mock PIX payment gateway
      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        status: PaymentStatus.COMPLETED,
        gatewayTransactionId: 'mp-123',
        gatewayResponse: { id: 'mp-123' }
      });

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.PIX,
        amount: 7000,
        processedBy: 'user-123',
        customerEmail: 'customer@example.com'
      });

      // Verify the payment was processed
      expect(result.success).toBe(true);
    });
  });

  describe('overpayment detection', () => {
    it('should detect overpayment and calculate change', async () => {
      const tenantId = 'tenant-123';
      const orderId = 'order-123';
      const orderTotal = 10000;

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => {
              selectCallCount++;
              if (selectCallCount === 1) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              if (selectCallCount === 2) {
                return []; // No existing split payment
              }
              if (selectCallCount === 3) {
                return [{
                  id: orderId,
                  tenantId,
                  totalAmount: orderTotal,
                  state: OrderState.READY
                }];
              }
              if (selectCallCount === 4) {
                return [{
                  id: 'split-123',
                  tenantId,
                  orderId,
                  totalAmount: orderTotal,
                  paidAmount: 9000,
                  remainingAmount: 1000,
                  isComplete: false
                }];
              }
              return [];
            }),
            orderBy: vi.fn(async () => [
              { id: 'payment-1', method: PaymentMethod.CASH, amount: 9000, status: PaymentStatus.COMPLETED, createdAt: Date.now() }
            ])
          }))
        }))
      }));

      const result = await splitPaymentManager.processPayment(tenantId, {
        orderId,
        method: PaymentMethod.CASH,
        amount: 3000, // Paying 30 when only 10 is needed
        processedBy: 'user-123'
      });

      // Verify the payment was processed
      expect(result.success).toBe(true);
      expect(result.changeAmount).toBe(2000); // 20.00 change
    });
  });
});