// Tests for Stock Alert API routes
// Requirements: 3.5

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import stockAlertsApp from './stock-alerts';
import { createStockAlertService } from '../services/stock-alert';
import { StockAlertType, StockAlertSeverity } from '../db/schema';

// Mock the stock alert service
vi.mock('../services/stock-alert');
const mockCreateStockAlertService = createStockAlertService as vi.MockedFunction<typeof createStockAlertService>;

// Mock stock alert service instance
const mockStockAlertService = {
  createOrUpdateAlertConfig: vi.fn(),
  monitorStockLevels: vi.fn(),
  getStockAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  getStockLevelInfo: vi.fn(),
  deleteAlertConfig: vi.fn()
};

describe('Stock Alerts API Routes', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateStockAlertService.mockReturnValue(mockStockAlertService as any);
    
    app = new Hono();
    app.route('/stock-alerts', stockAlertsApp);
  });

  describe('POST /stock-alerts/config', () => {
    it('should create stock alert configuration successfully', async () => {
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
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      mockStockAlertService.createOrUpdateAlertConfig.mockResolvedValue({
        success: true,
        config: mockConfig
      });

      const response = await app.request('/stock-alerts/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          outOfStockThreshold: 10,
          alertEnabled: true,
          emailNotifications: true,
          smsNotifications: false,
          createdBy: 'user-1'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.config).toEqual(mockConfig);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await app.request('/stock-alerts/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          productId: 'product-1'
          // Missing locationId and createdBy
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid threshold values', async () => {
      mockStockAlertService.createOrUpdateAlertConfig.mockResolvedValue({
        success: false,
        error: 'Low stock threshold must be greater than or equal to critical stock threshold',
        errorCode: 'INVALID_THRESHOLD'
      });

      const response = await app.request('/stock-alerts/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 50,
          criticalStockThreshold: 100, // Invalid: critical > low
          createdBy: 'user-1'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Low stock threshold must be greater than or equal to critical stock threshold');
    });

    it('should return 400 for missing tenant ID', async () => {
      const response = await app.request('/stock-alerts/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
          // Missing x-tenant-id header
        },
        body: JSON.stringify({
          productId: 'product-1',
          locationId: 'location-1',
          lowStockThreshold: 100,
          criticalStockThreshold: 50,
          createdBy: 'user-1'
        })
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Tenant ID is required');
    });
  });

  describe('POST /stock-alerts/monitor', () => {
    it('should monitor stock levels and return results', async () => {
      const mockResult = {
        success: true,
        alertsGenerated: [{
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
          createdAt: Date.now(),
          updatedAt: Date.now()
        }],
        alertsResolved: []
      };

      mockStockAlertService.monitorStockLevels.mockResolvedValue(mockResult);

      const response = await app.request('/stock-alerts/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          locationId: 'location-1',
          productIds: ['product-1']
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.alertsGenerated).toHaveLength(1);
      expect(data.summary.newAlerts).toBe(1);
      expect(data.summary.resolvedAlerts).toBe(0);
    });

    it('should handle monitoring errors', async () => {
      mockStockAlertService.monitorStockLevels.mockResolvedValue({
        success: false,
        error: 'Inventory service unavailable',
        errorCode: 'INVENTORY_ERROR'
      });

      const response = await app.request('/stock-alerts/monitor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          locationId: 'location-1'
        })
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Inventory service unavailable');
    });
  });

  describe('GET /stock-alerts', () => {
    it('should return paginated stock alerts', async () => {
      const mockAlerts = [{
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        productName: 'Test Product',
        locationName: 'Test Location'
      }];

      mockStockAlertService.getStockAlerts.mockResolvedValue({
        alerts: mockAlerts,
        total: 1
      });

      const response = await app.request('/stock-alerts?limit=10&offset=0&resolved=false', {
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.alerts).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
      expect(data.pagination.hasMore).toBe(false);
    });

    it('should validate alert type parameter', async () => {
      const response = await app.request('/stock-alerts?alertType=INVALID_TYPE', {
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid alert type');
    });

    it('should validate severity parameter', async () => {
      const response = await app.request('/stock-alerts?severity=INVALID_SEVERITY', {
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid severity');
    });
  });

  describe('POST /stock-alerts/:alertId/acknowledge', () => {
    it('should acknowledge alert successfully', async () => {
      mockStockAlertService.acknowledgeAlert.mockResolvedValue({
        success: true
      });

      const response = await app.request('/stock-alerts/alert-1/acknowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({
          acknowledgedBy: 'user-1'
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Alert acknowledged successfully');
    });

    it('should return 400 for missing acknowledgedBy', async () => {
      const response = await app.request('/stock-alerts/alert-1/acknowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant-1'
        },
        body: JSON.stringify({})
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('acknowledgedBy is required');
    });
  });

  describe('GET /stock-alerts/stock-levels', () => {
    it('should return stock level information', async () => {
      const mockStockInfo = [{
        productId: 'product-1',
        locationId: 'location-1',
        currentStock: 75,
        availableStock: 75,
        reservedStock: 0,
        inTransitStock: 0,
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
          smsNotifications: false,
          createdBy: 'user-1',
          createdAt: Date.now(),
          updatedAt: Date.now()
        },
        activeAlerts: []
      }];

      mockStockAlertService.getStockLevelInfo.mockResolvedValue(mockStockInfo);

      const response = await app.request('/stock-alerts/stock-levels?locationId=location-1&productIds=product-1', {
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.stockLevels).toHaveLength(1);
      expect(data.stockLevels[0].currentStock).toBe(75);
    });

    it('should return 400 for missing location ID', async () => {
      const response = await app.request('/stock-alerts/stock-levels', {
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Location ID is required');
    });
  });

  describe('DELETE /stock-alerts/config/:productId/:locationId', () => {
    it('should delete alert configuration successfully', async () => {
      mockStockAlertService.deleteAlertConfig.mockResolvedValue({
        success: true
      });

      const response = await app.request('/stock-alerts/config/product-1/location-1', {
        method: 'DELETE',
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe('Alert configuration deleted successfully');
    });

    it('should handle deletion errors', async () => {
      mockStockAlertService.deleteAlertConfig.mockResolvedValue({
        success: false,
        error: 'Configuration not found'
      });

      const response = await app.request('/stock-alerts/config/product-1/location-1', {
        method: 'DELETE',
        headers: {
          'x-tenant-id': 'tenant-1'
        }
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Configuration not found');
    });
  });

  describe('GET /stock-alerts/health', () => {
    it('should return health status', async () => {
      const response = await app.request('/stock-alerts/health');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.service).toBe('stock-alert-system');
      expect(data.timestamp).toBeDefined();
    });
  });
});