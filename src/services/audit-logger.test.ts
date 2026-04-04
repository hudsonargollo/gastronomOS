import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditLogger, createAuditLogger } from './audit-logger';
import { auditLogs } from '../db/schema';

/**
 * Unit tests for AuditLogger service
 * Tests Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

describe('AuditLogger', () => {
  let mockDb: any;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    // Mock database
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    };

    auditLogger = new AuditLogger(mockDb);
  });

  describe('logEvent', () => {
    it('should create an audit log entry with all required fields', async () => {
      const context = {
        tenantId: 'tenant-1',
        entityType: 'order',
        entityId: 'order-123',
        action: 'CREATE',
        userId: 'user-1',
        userType: 'waiter' as const,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      };

      await auditLogger.logEvent(context);

      expect(mockDb.insert).toHaveBeenCalledWith(auditLogs);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          entityType: 'order',
          entityId: 'order-123',
          action: 'CREATE',
          userId: 'user-1',
          userType: 'waiter',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
        })
      );
    });

    it('should serialize oldValue and newValue as JSON', async () => {
      const context = {
        tenantId: 'tenant-1',
        entityType: 'order',
        entityId: 'order-123',
        action: 'UPDATE',
        oldValue: { status: 'PLACED' },
        newValue: { status: 'PREPARING' },
        userId: 'user-1',
        userType: 'kitchen' as const,
      };

      await auditLogger.logEvent(context);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: JSON.stringify({ status: 'PLACED' }),
          newValue: JSON.stringify({ status: 'PREPARING' }),
        })
      );
    });

    it('should handle missing optional fields', async () => {
      const context = {
        tenantId: 'tenant-1',
        entityType: 'order',
        entityId: 'order-123',
        action: 'CREATE',
        userType: 'system' as const,
      };

      await auditLogger.logEvent(context);

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
          ipAddress: null,
          userAgent: null,
          oldValue: null,
          newValue: null,
        })
      );
    });

    it('should not throw error if database insert fails', async () => {
      mockDb.insert().values.mockRejectedValue(new Error('Database error'));

      const context = {
        tenantId: 'tenant-1',
        entityType: 'order',
        entityId: 'order-123',
        action: 'CREATE',
        userType: 'system' as const,
      };

      // Should not throw
      await expect(auditLogger.logEvent(context)).resolves.toBeUndefined();
    });
  });

  describe('logOrderStateChange', () => {
    it('should log order state transition', async () => {
      await auditLogger.logOrderStateChange(
        'tenant-1',
        'order-123',
        'PLACED',
        'PREPARING',
        'user-1',
        'kitchen',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'order',
          entityId: 'order-123',
          action: 'STATE_CHANGE',
          oldValue: JSON.stringify({ state: 'PLACED' }),
          newValue: JSON.stringify({ state: 'PREPARING' }),
          userId: 'user-1',
          userType: 'kitchen',
        })
      );
    });
  });

  describe('logPaymentTransaction', () => {
    it('should log payment transaction', async () => {
      const paymentData = {
        method: 'PIX',
        amount: 5000,
        status: 'COMPLETED',
      };

      await auditLogger.logPaymentTransaction(
        'tenant-1',
        'payment-123',
        'order-123',
        'CREATE',
        paymentData,
        'user-1',
        'cashier'
      );

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'payment',
          entityId: 'payment-123',
          action: 'CREATE',
          newValue: JSON.stringify(paymentData),
          userId: 'user-1',
          userType: 'cashier',
        })
      );
    });
  });

  describe('logInventoryConsumption', () => {
    it('should log inventory consumption', async () => {
      await auditLogger.logInventoryConsumption(
        'tenant-1',
        'consumption-123',
        'order-123',
        'product-456',
        5.5,
        'kg',
        'user-1',
        'system'
      );

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'inventory_consumption',
          entityId: 'consumption-123',
          action: 'CONSUME',
          userId: 'user-1',
          userType: 'system',
        })
      );
    });
  });

  describe('logInventoryConsumptionReversal', () => {
    it('should log inventory consumption reversal', async () => {
      await auditLogger.logInventoryConsumptionReversal(
        'tenant-1',
        'consumption-123',
        'order-123',
        'Order cancelled',
        'user-1',
        'manager'
      );

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'inventory_consumption',
          entityId: 'consumption-123',
          action: 'REVERSE',
          userId: 'user-1',
          userType: 'manager',
        })
      );
    });
  });

  describe('queryAuditLogs', () => {
    it('should query audit logs with tenant filter', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          entityType: 'order',
          entityId: 'order-123',
          action: 'CREATE',
          timestamp: Date.now(),
        },
      ];

      mockDb.select().from().where().orderBy().limit().offset.mockResolvedValue(mockLogs);

      const result = await auditLogger.queryAuditLogs({
        tenantId: 'tenant-1',
      });

      expect(result).toEqual(mockLogs);
    });

    it('should apply all filters when provided', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      await auditLogger.queryAuditLogs({
        tenantId: 'tenant-1',
        entityType: 'order',
        entityId: 'order-123',
        action: 'CREATE',
        userId: 'user-1',
        userType: 'waiter',
        dateFrom,
        dateTo,
        limit: 50,
        offset: 10,
      });

      expect(mockDb.select).toHaveBeenCalled();
    });
  });

  describe('generateAuditTrailReport', () => {
    it('should generate audit trail report with summary statistics', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          entityType: 'order',
          entityId: 'order-123',
          action: 'CREATE',
          userId: 'user-1',
          timestamp: Date.now(),
        },
        {
          id: 'audit-2',
          tenantId: 'tenant-1',
          entityType: 'payment',
          entityId: 'payment-123',
          action: 'COMPLETE',
          userId: 'user-2',
          timestamp: Date.now(),
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(mockLogs);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const report = await auditLogger.generateAuditTrailReport(
        'tenant-1',
        dateFrom,
        dateTo
      );

      expect(report.total).toBe(2);
      expect(report.summary.totalEvents).toBe(2);
      expect(report.summary.eventsByType).toEqual({
        order: 1,
        payment: 1,
      });
      expect(report.summary.eventsByAction).toEqual({
        CREATE: 1,
        COMPLETE: 1,
      });
      expect(report.summary.eventsByUser).toEqual({
        'user-1': 1,
        'user-2': 1,
      });
    });
  });

  describe('exportAuditLogsToCSV', () => {
    it('should export audit logs to CSV format', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          tenantId: 'tenant-1',
          entityType: 'order',
          entityId: 'order-123',
          action: 'CREATE',
          userId: 'user-1',
          userType: 'waiter',
          oldValue: null,
          newValue: '{"status":"PLACED"}',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          timestamp: new Date('2024-01-01T12:00:00Z').getTime(),
        },
      ];

      mockDb.select().from().where().orderBy().limit().offset.mockResolvedValue(mockLogs);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const csv = await auditLogger.exportAuditLogsToCSV('tenant-1', dateFrom, dateTo);

      expect(csv).toContain('Timestamp,Entity Type,Entity ID,Action');
      expect(csv).toContain('order,order-123,CREATE');
      expect(csv).toContain('user-1,waiter');
    });
  });

  describe('getAuditStatistics', () => {
    it('should calculate audit statistics', async () => {
      const mockLogs = [
        {
          id: 'audit-1',
          entityType: 'order',
          action: 'STATE_CHANGE',
          timestamp: new Date('2024-01-01').getTime(),
        },
        {
          id: 'audit-2',
          entityType: 'payment',
          action: 'CREATE',
          timestamp: new Date('2024-01-02').getTime(),
        },
        {
          id: 'audit-3',
          entityType: 'inventory_consumption',
          action: 'CONSUME',
          timestamp: new Date('2024-01-02').getTime(),
        },
      ];

      mockDb.select().from().where().orderBy().limit().offset.mockResolvedValue(mockLogs);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const stats = await auditLogger.getAuditStatistics('tenant-1', dateFrom, dateTo);

      expect(stats.totalEvents).toBe(3);
      expect(stats.orderStateChanges).toBe(1);
      expect(stats.paymentTransactions).toBe(1);
      expect(stats.inventoryConsumptions).toBe(1);
      expect(stats.eventsByDay['2024-01-01']).toBe(1);
      expect(stats.eventsByDay['2024-01-02']).toBe(2);
    });
  });

  describe('createAuditLogger factory', () => {
    it('should create AuditLogger instance', () => {
      const logger = createAuditLogger(mockDb);
      expect(logger).toBeInstanceOf(AuditLogger);
    });
  });
});
