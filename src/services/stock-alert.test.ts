// Unit tests for Stock Alert Service
// Requirements: 3.5

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  StockAlertService, 
  createStockAlertService,
  StockAlertErrorCode,
  type StockAlertConfigRequest,
  type StockMonitoringRequest
} from './stock-alert';
import { 
  StockAlertType, 
  StockAlertSeverity,
  NotificationType,
  NotificationStatus
} from '../db/schema';
import { createInventoryIntegrationService } from './inventory-integration';

// Mock the inventory integration service
vi.mock('./inventory-integration');
const mockCreateInventoryIntegrationService = createInventoryIntegrationService as MockedFunction<typeof createInventoryIntegrationService>;

// Mock database
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]) // No existing config by default
      }),
      leftJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      })
    })
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined)
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined)
    })
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined)
  })
} as unknown as DrizzleD1Database;

// Mock inventory service
const mockInventoryService = {
  checkInventoryAvailability: vi.fn()
};

describe('StockAlertService', () => {
  let stockAlertService: StockAlertService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup inventory service mock
    mockCreateInventoryIntegrationService.mockReturnValue(mockInventoryService as any);
    
    stockAlertService = createStockAlertService(mockDb);
  });

  describe('createOrUpdateAlertConfig', () => {
    it('should create new alert configuration with valid thresholds', async () => {
      const request: StockAlertConfigRequest = {
        tenantId: 'tenant-1',
        productId: 'product-1',
        locationId: 'location-1',
        lowStockThreshold: 100,
        criticalStockThreshold: 50,
        outOfStockThreshold: 10,
        alertEnabled: true,
        emailNotifications: true,
        smsNotifications: false,
        createdBy: 'user-1'
      };

      const mockConfig = {
        id: 'config-1',
        tenantId: 'tenant-1',
        productId: 'product-1',
        locationId: 'location-1',
        lowStockThreshold: 100,
        criticalStockThreshold: 50,
        outOfStockThreshold: 10,
        alertEnabled: true,
        emailNotifications: true,
        smsNotifications: false,
        createdBy: 'user-1',
        createdAt: 1234567890,
        updatedAt: 1234567890
      };

      // Mock the database calls properly
      const mockSelectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]) // No existing config
          })
        })
      };

      const mockInsertChain = {
        values: vi.fn().mockResolvedValue(undefined)
      };

      const mockSelectWithJoinChain = {
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  config: mockConfig,
                  productName: 'Test Product',
                  locationName: 'Test Location'
                }])
              })
            })
          })
        })
      };

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelectChain)
        .mockReturnValueOnce(mockSelectWithJoinChain);
      (mockDb.insert as any).mockReturnValue(mockInsertChain);

      const result = await stockAlertService.createOrUpdateAlertConfig(request);

      expect(result.success).toBe(true);
      expect(result.config).toBeDefined();
      expect(result.config?.lowStockThreshold).toBe(100);
      expect(result.config?.criticalStockThreshold).toBe(50);
      expect(result.config?.outOfStockThreshold).toBe(10);
      expect(result.config?.productName).toBe('Test Product');
      expect(result.config?.locationName).toBe('Test Location');
    });

    it('should reject invalid threshold configuration', async () => {
      const request: StockAlertConfigRequest = {
        tenantId: 'tenant-1',
        productId: 'product-1',
        locationId: 'location-1',
        lowStockThreshold: 50, // Invalid: less than critical
        criticalStockThreshold: 100,
        outOfStockThreshold: 10,
        createdBy: 'user-1'
      };

      const result = await stockAlertService.createOrUpdateAlertConfig(request);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(StockAlertErrorCode.INVALID_THRESHOLD);
      expect(result.error).toContain('Low stock threshold must be greater than or equal to critical stock threshold');
    });
  });

  describe('monitorStockLevels', () => {
    it('should generate low stock alert when inventory falls below threshold', async () => {
      const request: StockMonitoringRequest = {
        tenantId: 'tenant-1',
        locationId: 'location-1'
      };

      // Mock alert configurations
      const mockConfigs = [{
        config: {
          id: 'config-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false
        },
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockConfigs)
            })
          })
        })
      });

      const mockExistingAlertsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]) // No existing alerts
        })
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockExistingAlertsSelect)
        .mockReturnValue(mockInsert);

      (mockDb.insert as any).mockReturnValue(mockInsert);

      // Mock inventory service to return low stock
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        currentQuantity: 75, // Below low stock threshold (100)
        availableQuantity: 75,
        reservedQuantity: 0,
        inTransitQuantity: 0
      });

      const result = await stockAlertService.monitorStockLevels(request);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toHaveLength(1);
      expect(result.alertsGenerated?.[0].alertType).toBe(StockAlertType.LOW_STOCK);
      expect(result.alertsGenerated?.[0].severity).toBe(StockAlertSeverity.MEDIUM);
      expect(result.alertsGenerated?.[0].currentStock).toBe(75);
      expect(result.alertsGenerated?.[0].threshold).toBe(100);
    });

    it('should generate critical stock alert when inventory falls below critical threshold', async () => {
      const request: StockMonitoringRequest = {
        tenantId: 'tenant-1',
        locationId: 'location-1'
      };

      const mockConfigs = [{
        config: {
          id: 'config-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false
        },
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockConfigs)
            })
          })
        })
      });

      const mockExistingAlertsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockExistingAlertsSelect)
        .mockReturnValue(mockInsert);

      (mockDb.insert as any).mockReturnValue(mockInsert);

      // Mock inventory service to return critical stock
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        currentQuantity: 25, // Below critical threshold (50)
        availableQuantity: 25,
        reservedQuantity: 0,
        inTransitQuantity: 0
      });

      const result = await stockAlertService.monitorStockLevels(request);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toHaveLength(1);
      expect(result.alertsGenerated?.[0].alertType).toBe(StockAlertType.CRITICAL_STOCK);
      expect(result.alertsGenerated?.[0].severity).toBe(StockAlertSeverity.HIGH);
      expect(result.alertsGenerated?.[0].currentStock).toBe(25);
    });

    it('should generate out of stock alert when inventory falls to zero', async () => {
      const request: StockMonitoringRequest = {
        tenantId: 'tenant-1',
        locationId: 'location-1'
      };

      const mockConfigs = [{
        config: {
          id: 'config-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false
        },
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockConfigs)
            })
          })
        })
      });

      const mockExistingAlertsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([])
        })
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined)
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockExistingAlertsSelect)
        .mockReturnValue(mockInsert);

      (mockDb.insert as any).mockReturnValue(mockInsert);

      // Mock inventory service to return out of stock
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: false,
        currentQuantity: 5, // Below out of stock threshold (10)
        availableQuantity: 5,
        reservedQuantity: 0,
        inTransitQuantity: 0
      });

      const result = await stockAlertService.monitorStockLevels(request);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toHaveLength(1);
      expect(result.alertsGenerated?.[0].alertType).toBe(StockAlertType.OUT_OF_STOCK);
      expect(result.alertsGenerated?.[0].severity).toBe(StockAlertSeverity.CRITICAL);
      expect(result.alertsGenerated?.[0].currentStock).toBe(5);
    });

    it('should resolve alerts when stock levels return to normal', async () => {
      const request: StockMonitoringRequest = {
        tenantId: 'tenant-1',
        locationId: 'location-1'
      };

      const mockConfigs = [{
        config: {
          id: 'config-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false
        },
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      const mockExistingAlerts = [{
        id: 'alert-1',
        tenantId: 'tenant-1',
        productId: 'product-1',
        locationId: 'location-1',
        alertType: StockAlertType.LOW_STOCK,
        resolved: false
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockConfigs)
            })
          })
        })
      });

      const mockExistingAlertsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockExistingAlerts)
        })
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockExistingAlertsSelect);

      (mockDb.update as any).mockReturnValue(mockUpdate);

      // Mock inventory service to return normal stock levels
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        currentQuantity: 150, // Above low stock threshold
        availableQuantity: 150,
        reservedQuantity: 0,
        inTransitQuantity: 0
      });

      const result = await stockAlertService.monitorStockLevels(request);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toHaveLength(0);
      expect(result.alertsResolved).toHaveLength(1);
      expect(result.alertsResolved?.[0]).toBe('alert-1');
    });

    it('should not generate duplicate alerts for same alert type', async () => {
      const request: StockMonitoringRequest = {
        tenantId: 'tenant-1',
        locationId: 'location-1'
      };

      const mockConfigs = [{
        config: {
          id: 'config-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false
        },
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      const mockExistingAlerts = [{
        id: 'alert-1',
        tenantId: 'tenant-1',
        productId: 'product-1',
        locationId: 'location-1',
        alertType: StockAlertType.LOW_STOCK,
        resolved: false
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(mockConfigs)
            })
          })
        })
      });

      const mockExistingAlertsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockExistingAlerts)
        })
      });

      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockExistingAlertsSelect);

      (mockDb.update as any).mockReturnValue(mockUpdate);

      // Mock inventory service to return low stock (same as existing alert)
      mockInventoryService.checkInventoryAvailability.mockResolvedValue({
        available: true,
        currentQuantity: 75, // Below low stock threshold
        availableQuantity: 75,
        reservedQuantity: 0,
        inTransitQuantity: 0
      });

      const result = await stockAlertService.monitorStockLevels(request);

      expect(result.success).toBe(true);
      expect(result.alertsGenerated).toHaveLength(0); // No new alerts generated
      expect(result.alertsResolved).toHaveLength(0);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should successfully acknowledge an alert', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      (mockDb.update as any).mockReturnValue(mockUpdate);

      const result = await stockAlertService.acknowledgeAlert('alert-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled();
    });
  });

  describe('getStockAlerts', () => {
    it('should return paginated stock alerts with filters', async () => {
      const mockAlerts = [{
        alert: {
          id: 'alert-1',
          tenantId: 'tenant-1',
          productId: 'product-1',
          locationId: 'location-1',
          alertType: StockAlertType.LOW_STOCK,
          currentStock: 75,
          threshold: 100,
          severity: StockAlertSeverity.MEDIUM,
          message: 'Low stock alert',
          acknowledged: false,
          resolved: false,
          createdAt: 1234567890,
          updatedAt: 1234567890
        },
        productName: 'Test Product',
        locationName: 'Test Location',
        acknowledgedByName: null
      }];

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue(mockAlerts)
                    })
                  })
                })
              })
            })
          })
        })
      });

      const mockCountSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 1 }])
        })
      });

      const mockNotificationsSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([])
          })
        })
      });

      (mockDb.select as any)
        .mockReturnValueOnce(mockSelect)
        .mockReturnValueOnce(mockCountSelect)
        .mockReturnValueOnce(mockNotificationsSelect);

      const result = await stockAlertService.getStockAlerts('tenant-1', {
        resolved: false,
        limit: 10,
        offset: 0
      });

      expect(result.alerts).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.alerts[0].alertType).toBe(StockAlertType.LOW_STOCK);
      expect(result.alerts[0].productName).toBe('Test Product');
    });
  });

  describe('deleteAlertConfig', () => {
    it('should delete alert configuration and resolve active alerts', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined)
        })
      });

      const mockDelete = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined)
      });

      (mockDb.update as any).mockReturnValue(mockUpdate);
      (mockDb.delete as any).mockReturnValue(mockDelete);

      const result = await stockAlertService.deleteAlertConfig('tenant-1', 'product-1', 'location-1');

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalled(); // Resolve active alerts
      expect(mockDelete).toHaveBeenCalled(); // Delete config
    });
  });
});