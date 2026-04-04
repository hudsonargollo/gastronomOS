import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryConsumptionTracker, createInventoryConsumptionTracker } from './inventory-consumption-tracker';
import { inventoryConsumptions } from '../db/schema';

/**
 * Unit tests for InventoryConsumptionTracker service
 * Tests Requirements: 3.1, 3.2, 9.2
 */

describe('InventoryConsumptionTracker', () => {
  let mockDb: any;
  let mockAuditLogger: any;
  let tracker: InventoryConsumptionTracker;

  beforeEach(() => {
    // Mock database
    mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    // Mock audit logger
    mockAuditLogger = {
      logInventoryConsumption: vi.fn().mockResolvedValue(undefined),
      logInventoryConsumptionReversal: vi.fn().mockResolvedValue(undefined),
    };

    tracker = new InventoryConsumptionTracker(mockDb, mockAuditLogger);
  });

  describe('logConsumption', () => {
    it('should log inventory consumption with all required fields', async () => {
      const mockConsumption = {
        id: 'consumption-123',
        tenantId: 'tenant-1',
        orderId: 'order-123',
        productId: 'product-456',
        locationId: 'location-789',
        quantityConsumed: 5.5,
        unit: 'kg',
        consumedAt: Date.now(),
        reversedAt: null,
        reversedBy: null,
        notes: null,
      };

      mockDb.select().from().where.mockResolvedValue([mockConsumption]);

      const consumption = {
        orderId: 'order-123',
        productId: 'product-456',
        locationId: 'location-789',
        quantityConsumed: 5.5,
        unit: 'kg',
      };

      const result = await tracker.logConsumption('tenant-1', consumption, 'user-1');

      expect(mockDb.insert).toHaveBeenCalledWith(inventoryConsumptions);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-456',
          locationId: 'location-789',
          quantityConsumed: 5.5,
          unit: 'kg',
          reversedAt: null,
          reversedBy: null,
        })
      );

      expect(mockAuditLogger.logInventoryConsumption).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(String),
        'order-123',
        'product-456',
        5.5,
        'kg',
        'user-1',
        'system'
      );

      expect(result).toEqual(mockConsumption);
    });

    it('should include notes if provided', async () => {
      const mockConsumption = {
        id: 'consumption-123',
        tenantId: 'tenant-1',
        orderId: 'order-123',
        productId: 'product-456',
        locationId: 'location-789',
        quantityConsumed: 5.5,
        unit: 'kg',
        consumedAt: Date.now(),
        reversedAt: null,
        reversedBy: null,
        notes: 'Special order',
      };

      mockDb.select().from().where.mockResolvedValue([mockConsumption]);

      const consumption = {
        orderId: 'order-123',
        productId: 'product-456',
        locationId: 'location-789',
        quantityConsumed: 5.5,
        unit: 'kg',
        notes: 'Special order',
      };

      await tracker.logConsumption('tenant-1', consumption, 'user-1');

      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: 'Special order',
        })
      );
    });
  });

  describe('logBatchConsumption', () => {
    it('should log multiple consumptions in batch', async () => {
      const consumptions = [
        {
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.5,
          unit: 'kg',
        },
        {
          orderId: 'order-123',
          productId: 'product-2',
          locationId: 'location-789',
          quantityConsumed: 1.0,
          unit: 'L',
        },
      ];

      const mockConsumptions = consumptions.map((c, i) => ({
        id: `consumption-${i}`,
        tenantId: 'tenant-1',
        ...c,
        consumedAt: Date.now(),
        reversedAt: null,
        reversedBy: null,
        notes: null,
      }));

      mockDb.select().from().where.mockResolvedValue(mockConsumptions);

      const result = await tracker.logBatchConsumption('tenant-1', consumptions, 'user-1');

      expect(mockDb.insert).toHaveBeenCalledWith(inventoryConsumptions);
      expect(mockDb.insert().values).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ productId: 'product-1' }),
          expect.objectContaining({ productId: 'product-2' }),
        ])
      );

      expect(mockAuditLogger.logInventoryConsumption).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
    });
  });

  describe('reverseConsumption', () => {
    it('should reverse a consumption record', async () => {
      const mockConsumption = {
        id: 'consumption-123',
        tenantId: 'tenant-1',
        orderId: 'order-123',
        productId: 'product-456',
        locationId: 'location-789',
        quantityConsumed: 5.5,
        unit: 'kg',
        consumedAt: Date.now(),
        reversedAt: Date.now(),
        reversedBy: 'user-1',
        notes: 'Order cancelled',
      };

      mockDb.select().from().where.mockResolvedValue([mockConsumption]);

      const reversal = {
        consumptionId: 'consumption-123',
        reason: 'Order cancelled',
        reversedBy: 'user-1',
      };

      const result = await tracker.reverseConsumption('tenant-1', reversal);

      expect(mockDb.update).toHaveBeenCalledWith(inventoryConsumptions);
      expect(mockDb.update().set).toHaveBeenCalledWith(
        expect.objectContaining({
          reversedBy: 'user-1',
          notes: 'Order cancelled',
        })
      );

      expect(mockAuditLogger.logInventoryConsumptionReversal).toHaveBeenCalledWith(
        'tenant-1',
        'consumption-123',
        'order-123',
        'Order cancelled',
        'user-1',
        'system'
      );

      expect(result).toEqual(mockConsumption);
    });

    it('should throw error if consumption not found', async () => {
      mockDb.select().from().where.mockResolvedValue([]);

      const reversal = {
        consumptionId: 'consumption-123',
        reason: 'Order cancelled',
        reversedBy: 'user-1',
      };

      await expect(tracker.reverseConsumption('tenant-1', reversal)).rejects.toThrow(
        'Consumption record consumption-123 not found or already reversed'
      );
    });
  });

  describe('reverseOrderConsumptions', () => {
    it('should reverse all consumptions for an order', async () => {
      const mockConsumptions = [
        {
          id: 'consumption-1',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.5,
          unit: 'kg',
          consumedAt: Date.now(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
        {
          id: 'consumption-2',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-2',
          locationId: 'location-789',
          quantityConsumed: 1.0,
          unit: 'L',
          consumedAt: Date.now(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
      ];

      // First call returns non-reversed consumptions
      mockDb.select().from().where.mockResolvedValueOnce(mockConsumptions);

      // Subsequent calls return reversed consumptions
      mockDb.select().from().where.mockResolvedValue([
        { ...mockConsumptions[0], reversedAt: Date.now(), reversedBy: 'user-1' },
      ]);

      const result = await tracker.reverseOrderConsumptions(
        'tenant-1',
        'order-123',
        'Order cancelled',
        'user-1'
      );

      expect(result).toHaveLength(2);
      expect(mockAuditLogger.logInventoryConsumptionReversal).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOrderConsumptions', () => {
    it('should retrieve all consumptions for an order', async () => {
      const mockConsumptions = [
        {
          id: 'consumption-1',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.5,
          unit: 'kg',
          consumedAt: Date.now(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(mockConsumptions);

      const result = await tracker.getOrderConsumptions('tenant-1', 'order-123');

      expect(result).toEqual(mockConsumptions);
    });
  });

  describe('generateConsumptionReport', () => {
    it('should generate consumption report with summary statistics', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockConsumptions = [
        {
          id: 'consumption-1',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.5,
          unit: 'kg',
          consumedAt: new Date('2024-06-01').getTime(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
        {
          id: 'consumption-2',
          tenantId: 'tenant-1',
          orderId: 'order-124',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 3.0,
          unit: 'kg',
          consumedAt: new Date('2024-06-02').getTime(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
        {
          id: 'consumption-3',
          tenantId: 'tenant-1',
          orderId: 'order-125',
          productId: 'product-2',
          locationId: 'location-789',
          quantityConsumed: 1.0,
          unit: 'L',
          consumedAt: new Date('2024-06-03').getTime(),
          reversedAt: Date.now(),
          reversedBy: 'user-1',
          notes: 'Reversed',
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(mockConsumptions);

      const report = await tracker.generateConsumptionReport('tenant-1', dateFrom, dateTo);

      expect(report.total).toBe(3);
      expect(report.summary.totalConsumptions).toBe(2); // Excluding reversed
      expect(report.summary.totalReversals).toBe(1);
      expect(report.summary.totalQuantityByProduct['product-1']).toEqual({
        quantity: 5.5,
        unit: 'kg',
      });
      expect(report.summary.consumptionsByOrder['order-123']).toBe(1);
      expect(report.summary.consumptionsByOrder['order-124']).toBe(1);
    });
  });

  describe('exportConsumptionsToCSV', () => {
    it('should export consumptions to CSV format', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockConsumptions = [
        {
          id: 'consumption-1',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.5,
          unit: 'kg',
          consumedAt: new Date('2024-06-01').getTime(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(mockConsumptions);

      const csv = await tracker.exportConsumptionsToCSV('tenant-1', dateFrom, dateTo);

      expect(csv).toContain('Consumption ID,Order ID,Product ID');
      expect(csv).toContain('consumption-1,order-123,product-1');
      expect(csv).toContain('2.5,kg');
    });
  });

  describe('getLocationConsumptionStats', () => {
    it('should calculate location consumption statistics', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');

      const mockConsumptions = [
        {
          id: 'consumption-1',
          tenantId: 'tenant-1',
          orderId: 'order-123',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 5.0,
          unit: 'kg',
          consumedAt: new Date('2024-06-01').getTime(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
        {
          id: 'consumption-2',
          tenantId: 'tenant-1',
          orderId: 'order-124',
          productId: 'product-2',
          locationId: 'location-789',
          quantityConsumed: 3.0,
          unit: 'L',
          consumedAt: new Date('2024-06-01').getTime(),
          reversedAt: null,
          reversedBy: null,
          notes: null,
        },
        {
          id: 'consumption-3',
          tenantId: 'tenant-1',
          orderId: 'order-125',
          productId: 'product-1',
          locationId: 'location-789',
          quantityConsumed: 2.0,
          unit: 'kg',
          consumedAt: new Date('2024-06-02').getTime(),
          reversedAt: Date.now(),
          reversedBy: 'user-1',
          notes: 'Reversed',
        },
      ];

      mockDb.select().from().where().orderBy.mockResolvedValue(mockConsumptions);

      const stats = await tracker.getLocationConsumptionStats(
        'tenant-1',
        'location-789',
        dateFrom,
        dateTo
      );

      expect(stats.totalConsumptions).toBe(2); // Excluding reversed
      expect(stats.totalReversals).toBe(1);
      expect(stats.topProducts).toHaveLength(2);
      expect(stats.topProducts[0]).toEqual({
        productId: 'product-1',
        quantity: 5.0,
        unit: 'kg',
      });
      expect(stats.consumptionsByDay['2024-06-01']).toBe(2);
    });
  });

  describe('createInventoryConsumptionTracker factory', () => {
    it('should create InventoryConsumptionTracker instance', () => {
      const tracker = createInventoryConsumptionTracker(mockDb);
      expect(tracker).toBeInstanceOf(InventoryConsumptionTracker);
    });

    it('should create InventoryConsumptionTracker with custom audit logger', () => {
      const tracker = createInventoryConsumptionTracker(mockDb, mockAuditLogger);
      expect(tracker).toBeInstanceOf(InventoryConsumptionTracker);
    });
  });
});
