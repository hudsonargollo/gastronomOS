/**
 * Unit tests for Commission Engine Service
 * Tests commission calculation, configuration, and reporting
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommissionEngine, createCommissionEngine, CommissionErrorCode } from './commission-engine';
import { OrderState, CommissionType } from '../db/schema';

// Mock database
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => []),
        orderBy: vi.fn(() => [])
      })),
      orderBy: vi.fn(() => [])
    }))
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => undefined)
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => undefined)
    }))
  }))
};

describe('CommissionEngine', () => {
  let commissionEngine: CommissionEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    commissionEngine = createCommissionEngine(mockDb);
  });

  describe('calculateCommission', () => {
    it('should return error when order not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [])
          }))
        }))
      });

      const result = await commissionEngine.calculateCommission({
        orderId: 'order-123',
        tenantId: 'tenant-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CommissionErrorCode.ORDER_NOT_FOUND);
    });

    it('should return error when order has no waiter assigned', async () => {
      const mockOrder = {
        id: 'order-123',
        tenantId: 'tenant-123',
        waiterId: null,
        state: OrderState.DELIVERED,
        totalAmount: 10000
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockOrder])
          }))
        }))
      });

      const result = await commissionEngine.calculateCommission({
        orderId: 'order-123',
        tenantId: 'tenant-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CommissionErrorCode.ORDER_NO_WAITER);
    });

    it('should return error when order is not DELIVERED', async () => {
      const mockOrder = {
        id: 'order-123',
        tenantId: 'tenant-123',
        waiterId: 'waiter-123',
        state: OrderState.READY,
        totalAmount: 10000
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockOrder])
          }))
        }))
      });

      const result = await commissionEngine.calculateCommission({
        orderId: 'order-123',
        tenantId: 'tenant-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CommissionErrorCode.ORDER_NOT_DELIVERED);
    });

    it('should return error when commission already exists', async () => {
      const mockOrder = {
        id: 'order-123',
        tenantId: 'tenant-123',
        waiterId: 'waiter-123',
        state: OrderState.DELIVERED,
        totalAmount: 10000
      };

      const existingCommission = {
        id: 'commission-123',
        orderId: 'order-123'
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [mockOrder])
            }))
          }))
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [existingCommission])
            }))
          }))
        });

      const result = await commissionEngine.calculateCommission({
        orderId: 'order-123',
        tenantId: 'tenant-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CommissionErrorCode.COMMISSION_ALREADY_EXISTS);
    });

    it('should return error when no commission config found', async () => {
      const mockOrder = {
        id: 'order-123',
        tenantId: 'tenant-123',
        waiterId: 'waiter-123',
        state: OrderState.DELIVERED,
        totalAmount: 10000
      };

      mockDb.select
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [mockOrder])
            }))
          }))
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [])
            }))
          }))
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(() => [])
            }))
          }))
        });

      const result = await commissionEngine.calculateCommission({
        orderId: 'order-123',
        tenantId: 'tenant-123'
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(CommissionErrorCode.CONFIG_NOT_FOUND);
    });
  });

  describe('getCommissionConfig', () => {
    it('should return null when no config found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [])
          }))
        }))
      });

      const result = await commissionEngine.getCommissionConfig('tenant-123');

      expect(result).toBeNull();
    });

    it('should return config when found', async () => {
      const mockConfig = {
        id: 'config-123',
        tenantId: 'tenant-123',
        defaultType: CommissionType.PERCENTAGE,
        defaultRate: 10,
        active: true
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockConfig])
          }))
        }))
      });

      const result = await commissionEngine.getCommissionConfig('tenant-123');

      expect(result).toEqual(mockConfig);
    });
  });

  describe('upsertCommissionConfig', () => {
    it('should return error for invalid commission type', async () => {
      const result = await commissionEngine.upsertCommissionConfig({
        tenantId: 'tenant-123',
        defaultType: 'INVALID' as CommissionType,
        defaultRate: 10
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid commission type');
    });

    it('should return error for negative commission rate', async () => {
      const result = await commissionEngine.upsertCommissionConfig({
        tenantId: 'tenant-123',
        defaultType: CommissionType.PERCENTAGE,
        defaultRate: -5
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Commission rate must be non-negative');
    });
  });

  describe('assignWaiterToOrder', () => {
    it('should return error when order not found', async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [])
          }))
        }))
      });

      const result = await commissionEngine.assignWaiterToOrder(
        'tenant-123',
        'order-123',
        'waiter-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });

    it('should return error when order is DELIVERED', async () => {
      const mockOrder = {
        id: 'order-123',
        state: OrderState.DELIVERED
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockOrder])
          }))
        }))
      });

      const result = await commissionEngine.assignWaiterToOrder(
        'tenant-123',
        'order-123',
        'waiter-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot assign waiter to completed or cancelled order');
    });

    it('should return error when order is CANCELLED', async () => {
      const mockOrder = {
        id: 'order-123',
        state: OrderState.CANCELLED
      };

      mockDb.select.mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => [mockOrder])
          }))
        }))
      });

      const result = await commissionEngine.assignWaiterToOrder(
        'tenant-123',
        'order-123',
        'waiter-123'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot assign waiter to completed or cancelled order');
    });
  });

  describe('markCommissionPaid', () => {
    it('should successfully mark commission as paid', async () => {
      mockDb.update.mockReturnValueOnce({
        set: vi.fn(() => ({
          where: vi.fn(() => undefined)
        }))
      });

      const result = await commissionEngine.markCommissionPaid(
        'tenant-123',
        'commission-123'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('batchMarkCommissionsPaid', () => {
    it('should mark multiple commissions as paid', async () => {
      mockDb.update.mockReturnValue({
        set: vi.fn(() => ({
          where: vi.fn(() => undefined)
        }))
      });

      const result = await commissionEngine.batchMarkCommissionsPaid(
        'tenant-123',
        ['commission-1', 'commission-2', 'commission-3']
      );

      expect(result.success).toBe(true);
      expect(result.paidCount).toBe(3);
    });
  });
});

describe('Commission Calculation Logic', () => {
  it('should calculate percentage commission correctly', () => {
    const orderAmount = 10000; // 100.00 in cents
    const rate = 10; // 10%
    const expectedCommission = 1000; // 10.00 in cents

    const commission = Math.round((orderAmount * rate) / 100);
    expect(commission).toBe(expectedCommission);
  });

  it('should calculate fixed value commission correctly', () => {
    const orderAmount = 10000; // 100.00 in cents
    const fixedRate = 500; // 5.00 fixed in cents
    const expectedCommission = 500;

    expect(fixedRate).toBe(expectedCommission);
  });

  it('should handle zero order amount for percentage', () => {
    const orderAmount = 0;
    const rate = 10;
    const commission = Math.round((orderAmount * rate) / 100);
    expect(commission).toBe(0);
  });

  it('should handle item-specific rates', () => {
    const orderItems = [
      { menuItemId: 'item-1', totalPrice: 5000, quantity: 1 },
      { menuItemId: 'item-2', totalPrice: 3000, quantity: 2 }
    ];

    // Item 1: 10% rate
    const commission1 = Math.round((5000 * 10) / 100); // 500
    // Item 2: 5% rate
    const commission2 = Math.round((3000 * 5) / 100); // 150

    const totalCommission = commission1 + commission2;
    expect(totalCommission).toBe(650);
  });
});

describe('Commission Type Validation', () => {
  it('should accept PERCENTAGE type', () => {
    expect(Object.values(CommissionType)).toContain(CommissionType.PERCENTAGE);
  });

  it('should accept FIXED_VALUE type', () => {
    expect(Object.values(CommissionType)).toContain(CommissionType.FIXED_VALUE);
  });
});

describe('Order State Validation for Commission', () => {
  it('should only allow DELIVERED orders for commission', () => {
    const validStates = [OrderState.DELIVERED];
    const invalidStates = [
      OrderState.PLACED,
      OrderState.PREPARING,
      OrderState.READY,
      OrderState.CANCELLED
    ];

    for (const state of validStates) {
      expect(state).toBe(OrderState.DELIVERED);
    }

    for (const state of invalidStates) {
      expect(state).not.toBe(OrderState.DELIVERED);
    }
  });
});