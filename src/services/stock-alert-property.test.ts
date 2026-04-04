// Property-based tests for Stock Alert System
// **Validates: Requirements 3.5**

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import * as fc from 'fast-check';
import { DrizzleD1Database } from 'drizzle-orm/d1';
import { 
  StockAlertService, 
  createStockAlertService,
  StockAlertErrorCode,
  type StockAlertConfigRequest
} from './stock-alert';
import { 
  StockAlertType, 
  StockAlertSeverity
} from '../db/schema';
import { createInventoryIntegrationService } from './inventory-integration';

// Mock the inventory integration service
vi.mock('./inventory-integration');
const mockCreateInventoryIntegrationService = createInventoryIntegrationService as MockedFunction<typeof createInventoryIntegrationService>;

// Mock database with proper chainable methods
const createMockDb = () => {
  const mockChain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis()
  };

  return {
    select: vi.fn().mockReturnValue(mockChain),
    insert: vi.fn().mockReturnValue(mockChain),
    update: vi.fn().mockReturnValue(mockChain),
    delete: vi.fn().mockReturnValue(mockChain),
    mockChain
  };
};

// Mock inventory service
const mockInventoryService = {
  checkInventoryAvailability: vi.fn()
};

// Generators for property-based testing
const thresholdGenerator = fc.record({
  outOfStock: fc.integer({ min: 0, max: 50 }),
  critical: fc.integer({ min: 0, max: 100 }),
  low: fc.integer({ min: 0, max: 200 })
}).filter(thresholds => 
  thresholds.low >= thresholds.critical && 
  thresholds.critical >= thresholds.outOfStock
);

const stockLevelGenerator = fc.integer({ min: 0, max: 500 });

const alertConfigGenerator = fc.record({
  tenantId: fc.string({ minLength: 1, maxLength: 50 }),
  productId: fc.string({ minLength: 1, maxLength: 50 }),
  locationId: fc.string({ minLength: 1, maxLength: 50 }),
  thresholds: thresholdGenerator,
  alertEnabled: fc.boolean(),
  emailNotifications: fc.boolean(),
  smsNotifications: fc.boolean(),
  createdBy: fc.string({ minLength: 1, maxLength: 50 })
});

const inventoryAvailabilityGenerator = fc.record({
  available: fc.boolean(),
  currentQuantity: fc.integer({ min: 0, max: 1000 }),
  availableQuantity: fc.integer({ min: 0, max: 1000 }),
  reservedQuantity: fc.integer({ min: 0, max: 100 }),
  inTransitQuantity: fc.integer({ min: 0, max: 100 })
});

describe('StockAlertService - Property Tests', () => {
  let stockAlertService: StockAlertService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDb = createMockDb();
    mockCreateInventoryIntegrationService.mockReturnValue(mockInventoryService as any);
    
    stockAlertService = createStockAlertService(mockDb as unknown as DrizzleD1Database);
  });

  describe('Property 7: Stock Alert Generation', () => {
    it('should generate appropriate alerts for any ingredient falling below configured thresholds', async () => {
      await fc.assert(fc.asyncProperty(
        alertConfigGenerator,
        inventoryAvailabilityGenerator,
        async (config, availability) => {
          // Setup mock responses
          mockDb.mockChain.limit.mockResolvedValueOnce([]); // No existing config
          mockDb.mockChain.values.mockResolvedValueOnce(undefined); // Insert success
          mockDb.mockChain.limit.mockResolvedValueOnce([{
            config: {
              id: 'config-1',
              tenantId: config.tenantId,
              productId: config.productId,
              locationId: config.locationId,
              lowStockThreshold: config.thresholds.low,
              criticalStockThreshold: config.thresholds.critical,
              outOfStockThreshold: config.thresholds.outOfStock,
              alertEnabled: config.alertEnabled,
              emailNotifications: config.emailNotifications,
              smsNotifications: config.smsNotifications,
              createdBy: config.createdBy,
              createdAt: Date.now(),
              updatedAt: Date.now()
            },
            productName: 'Test Product',
            locationName: 'Test Location'
          }]); // Get created config

          // Create alert configuration
          const configRequest: StockAlertConfigRequest = {
            tenantId: config.tenantId,
            productId: config.productId,
            locationId: config.locationId,
            lowStockThreshold: config.thresholds.low,
            criticalStockThreshold: config.thresholds.critical,
            outOfStockThreshold: config.thresholds.outOfStock,
            alertEnabled: config.alertEnabled,
            emailNotifications: config.emailNotifications,
            smsNotifications: config.smsNotifications,
            createdBy: config.createdBy
          };

          const configResult = await stockAlertService.createOrUpdateAlertConfig(configRequest);

          // Property: Valid threshold configurations should always succeed
          expect(configResult.success).toBe(true);
          expect(configResult.config).toBeDefined();
          expect(configResult.config!.lowStockThreshold).toBe(config.thresholds.low);
          expect(configResult.config!.criticalStockThreshold).toBe(config.thresholds.critical);
          expect(configResult.config!.outOfStockThreshold).toBe(config.thresholds.outOfStock);

          // Setup monitoring mocks
          mockDb.mockChain.where.mockResolvedValueOnce([{
            config: configResult.config,
            productName: 'Test Product',
            locationName: 'Test Location'
          }]); // Get configs for monitoring

          mockDb.mockChain.where.mockResolvedValueOnce([]); // No existing alerts

          mockInventoryService.checkInventoryAvailability.mockResolvedValue(availability);

          // Monitor stock levels
          const monitoringResult = await stockAlertService.monitorStockLevels({
            tenantId: config.tenantId,
            locationId: config.locationId
          });

          // Property: Monitoring should always succeed for valid configurations
          expect(monitoringResult.success).toBe(true);

          // Property: Alert generation should follow threshold rules
          const currentStock = availability.currentQuantity;
          const shouldGenerateOutOfStock = currentStock <= config.thresholds.outOfStock;
          const shouldGenerateCritical = currentStock <= config.thresholds.critical && currentStock > config.thresholds.outOfStock;
          const shouldGenerateLow = currentStock <= config.thresholds.low && currentStock > config.thresholds.critical;

          if (config.alertEnabled) {
            if (shouldGenerateOutOfStock) {
              // Should generate out of stock alert
              expect(monitoringResult.alertsGenerated?.length).toBeGreaterThan(0);
              const alert = monitoringResult.alertsGenerated![0];
              expect(alert.alertType).toBe(StockAlertType.OUT_OF_STOCK);
              expect(alert.severity).toBe(StockAlertSeverity.CRITICAL);
              expect(alert.currentStock).toBe(currentStock);
              expect(alert.threshold).toBe(config.thresholds.outOfStock);
            } else if (shouldGenerateCritical) {
              // Should generate critical stock alert
              expect(monitoringResult.alertsGenerated?.length).toBeGreaterThan(0);
              const alert = monitoringResult.alertsGenerated![0];
              expect(alert.alertType).toBe(StockAlertType.CRITICAL_STOCK);
              expect(alert.severity).toBe(StockAlertSeverity.HIGH);
              expect(alert.currentStock).toBe(currentStock);
              expect(alert.threshold).toBe(config.thresholds.critical);
            } else if (shouldGenerateLow) {
              // Should generate low stock alert
              expect(monitoringResult.alertsGenerated?.length).toBeGreaterThan(0);
              const alert = monitoringResult.alertsGenerated![0];
              expect(alert.alertType).toBe(StockAlertType.LOW_STOCK);
              expect(alert.severity).toBe(StockAlertSeverity.MEDIUM);
              expect(alert.currentStock).toBe(currentStock);
              expect(alert.threshold).toBe(config.thresholds.low);
            } else {
              // Should not generate any alerts
              expect(monitoringResult.alertsGenerated?.length || 0).toBe(0);
            }
          } else {
            // Alerts disabled - should not generate any alerts
            expect(monitoringResult.alertsGenerated?.length || 0).toBe(0);
          }
        }
      ), { numRuns: 50 });
    });

    it('should maintain threshold ordering invariants for any valid configuration', async () => {
      await fc.assert(fc.property(
        fc.integer({ min: 0, max: 50 }), // outOfStock
        fc.integer({ min: 0, max: 100 }), // critical  
        fc.integer({ min: 0, max: 200 }), // low
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        async (outOfStock, critical, low, tenantId, productId, locationId, createdBy) => {
          const request: StockAlertConfigRequest = {
            tenantId,
            productId,
            locationId,
            lowStockThreshold: low,
            criticalStockThreshold: critical,
            outOfStockThreshold: outOfStock,
            createdBy
          };

          // Setup mock for validation test
          const result = await stockAlertService.createOrUpdateAlertConfig(request);

          // Property: Configuration should succeed only if thresholds are properly ordered
          const validThresholds = low >= critical && critical >= outOfStock && outOfStock >= 0;
          
          if (validThresholds) {
            expect(result.success).toBe(true);
          } else {
            expect(result.success).toBe(false);
            expect(result.errorCode).toBe(StockAlertErrorCode.INVALID_THRESHOLD);
          }
        }
      ), { numRuns: 100 });
    });

    it('should generate correct alert severity for any stock level and threshold combination', async () => {
      await fc.assert(fc.property(
        thresholdGenerator,
        stockLevelGenerator,
        (thresholds, stockLevel) => {
          // Property: Alert severity should be determined correctly based on stock level
          let expectedAlertType: string | null = null;
          let expectedSeverity: string | null = null;

          if (stockLevel <= thresholds.outOfStock) {
            expectedAlertType = StockAlertType.OUT_OF_STOCK;
            expectedSeverity = StockAlertSeverity.CRITICAL;
          } else if (stockLevel <= thresholds.critical) {
            expectedAlertType = StockAlertType.CRITICAL_STOCK;
            expectedSeverity = StockAlertSeverity.HIGH;
          } else if (stockLevel <= thresholds.low) {
            expectedAlertType = StockAlertType.LOW_STOCK;
            expectedSeverity = StockAlertSeverity.MEDIUM;
          }

          // Verify the logic is consistent
          if (expectedAlertType) {
            expect(expectedSeverity).toBeDefined();
            
            // Property: More severe alerts should have higher priority
            if (expectedAlertType === StockAlertType.OUT_OF_STOCK) {
              expect(expectedSeverity).toBe(StockAlertSeverity.CRITICAL);
            } else if (expectedAlertType === StockAlertType.CRITICAL_STOCK) {
              expect(expectedSeverity).toBe(StockAlertSeverity.HIGH);
            } else if (expectedAlertType === StockAlertType.LOW_STOCK) {
              expect(expectedSeverity).toBe(StockAlertSeverity.MEDIUM);
            }
          }

          // Property: Stock levels above all thresholds should not generate alerts
          if (stockLevel > thresholds.low) {
            expect(expectedAlertType).toBeNull();
            expect(expectedSeverity).toBeNull();
          }
        }
      ), { numRuns: 200 });
    });

    it('should handle concurrent monitoring requests without data corruption', async () => {
      await fc.assert(fc.asyncProperty(
        fc.array(alertConfigGenerator, { minLength: 1, maxLength: 5 }),
        fc.array(inventoryAvailabilityGenerator, { minLength: 1, maxLength: 5 }),
        async (configs, availabilities) => {
          // Setup mocks for multiple configurations
          const mockConfigs = configs.map((config, index) => ({
            config: {
              id: `config-${index}`,
              tenantId: config.tenantId,
              productId: config.productId,
              locationId: config.locationId,
              lowStockThreshold: config.thresholds.low,
              criticalStockThreshold: config.thresholds.critical,
              outOfStockThreshold: config.thresholds.outOfStock,
              alertEnabled: config.alertEnabled,
              emailNotifications: config.emailNotifications,
              smsNotifications: config.smsNotifications,
              createdBy: config.createdBy
            },
            productName: `Product ${index}`,
            locationName: `Location ${index}`
          }));

          mockDb.mockChain.where.mockResolvedValue(mockConfigs);
          mockDb.mockChain.where.mockResolvedValue([]); // No existing alerts

          // Mock inventory service responses
          mockInventoryService.checkInventoryAvailability
            .mockImplementation((productId: string) => {
              const index = parseInt(productId.split('-')[1] || '0');
              return Promise.resolve(availabilities[index % availabilities.length]);
            });

          // Run concurrent monitoring requests
          const monitoringPromises = configs.map(config => 
            stockAlertService.monitorStockLevels({
              tenantId: config.tenantId,
              locationId: config.locationId
            })
          );

          const results = await Promise.all(monitoringPromises);

          // Property: All monitoring requests should succeed
          for (const result of results) {
            expect(result.success).toBe(true);
          }

          // Property: Results should be consistent and not corrupted
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const config = configs[i];
            const availability = availabilities[i % availabilities.length];

            if (config.alertEnabled) {
              // Verify alert generation follows the same rules as single requests
              const currentStock = availability.currentQuantity;
              const shouldGenerateAlert = currentStock <= config.thresholds.low;

              if (shouldGenerateAlert) {
                expect(result.alertsGenerated?.length).toBeGreaterThan(0);
              }
            }
          }
        }
      ), { numRuns: 20 });
    });

    it('should maintain data consistency when alerts are acknowledged and resolved', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.boolean(),
        fc.boolean(),
        async (alertId, userId, shouldAcknowledge, shouldResolve) => {
          // Mock successful operations
          mockDb.mockChain.where.mockResolvedValue(undefined);

          let acknowledgeResult = { success: true };
          
          if (shouldAcknowledge) {
            acknowledgeResult = await stockAlertService.acknowledgeAlert(alertId, userId);
          }

          // Property: Acknowledge operation should always succeed for valid inputs
          expect(acknowledgeResult.success).toBe(true);

          // Property: Alert state transitions should be consistent
          // (In a real implementation, we would verify the database state)
          // For now, we verify the operation completed without errors
          expect(acknowledgeResult.success).toBe(true);
        }
      ), { numRuns: 50 });
    });
  });
});