/**
 * WebSocket Service Tests
 * Unit tests for WebSocket service functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketService } from './websocket-service';

describe('WebSocketService', () => {
  let mockDurableObjectNamespace: any;
  let mockStub: any;
  let webSocketService: WebSocketService;

  beforeEach(() => {
    // Mock Durable Object stub
    mockStub = {
      fetch: vi.fn()
    };

    // Mock Durable Object namespace
    mockDurableObjectNamespace = {
      idFromName: vi.fn(() => 'mock-id'),
      get: vi.fn(() => mockStub)
    };

    webSocketService = new WebSocketService(mockDurableObjectNamespace);
  });

  describe('broadcast', () => {
    it('should broadcast message to Durable Object', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true, broadcastCount: 5 })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      const result = await webSocketService.broadcast({
        tenantId: 'tenant-123',
        type: 'test-message',
        data: { foo: 'bar' }
      });

      expect(result.success).toBe(true);
      expect(result.broadcastCount).toBe(5);
      expect(mockDurableObjectNamespace.idFromName).toHaveBeenCalledWith('tenant-123');
      expect(mockStub.fetch).toHaveBeenCalled();
    });

    it('should handle broadcast errors gracefully', async () => {
      mockStub.fetch.mockRejectedValue(new Error('Network error'));

      const result = await webSocketService.broadcast({
        tenantId: 'tenant-123',
        type: 'test-message',
        data: { foo: 'bar' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('broadcastOrderStateChange', () => {
    it('should broadcast order state change with correct format', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true, broadcastCount: 3 })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      await webSocketService.broadcastOrderStateChange(
        'tenant-123',
        'order-456',
        'PREPARING',
        { id: 'order-456', state: 'PREPARING' }
      );

      expect(mockStub.fetch).toHaveBeenCalled();
      const fetchCall = mockStub.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      
      expect(body.type).toBe('order:state-change');
      expect(body.tenantId).toBe('tenant-123');
      expect(body.data.orderId).toBe('order-456');
      expect(body.data.newState).toBe('PREPARING');
    });
  });

  describe('broadcastInventoryUpdate', () => {
    it('should broadcast inventory availability change', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true, broadcastCount: 2 })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      await webSocketService.broadcastInventoryUpdate(
        'tenant-123',
        'menu-item-789',
        false,
        'Out of stock'
      );

      expect(mockStub.fetch).toHaveBeenCalled();
      const fetchCall = mockStub.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      
      expect(body.type).toBe('inventory:availability-change');
      expect(body.data.menuItemId).toBe('menu-item-789');
      expect(body.data.isAvailable).toBe(false);
      expect(body.data.reason).toBe('Out of stock');
    });
  });

  describe('broadcastPaymentStatusUpdate', () => {
    it('should broadcast payment status update', async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({ success: true, broadcastCount: 4 })
      };
      mockStub.fetch.mockResolvedValue(mockResponse);

      await webSocketService.broadcastPaymentStatusUpdate(
        'tenant-123',
        'order-456',
        'COMPLETED',
        { id: 'payment-789', status: 'COMPLETED' }
      );

      expect(mockStub.fetch).toHaveBeenCalled();
      const fetchCall = mockStub.fetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      
      expect(body.type).toBe('payment:status-change');
      expect(body.data.orderId).toBe('order-456');
      expect(body.data.paymentStatus).toBe('COMPLETED');
    });
  });

  describe('getWebSocketUrl', () => {
    it('should generate correct WebSocket URL with all parameters', () => {
      const url = webSocketService.getWebSocketUrl(
        'tenant-123',
        'user-456',
        'kitchen-display'
      );

      expect(url).toContain('tenantId=tenant-123');
      expect(url).toContain('userId=user-456');
      expect(url).toContain('interface=kitchen-display');
    });

    it('should generate URL without userId when not provided', () => {
      const url = webSocketService.getWebSocketUrl(
        'tenant-123',
        undefined,
        'qr-menu'
      );

      expect(url).toContain('tenantId=tenant-123');
      expect(url).toContain('interface=qr-menu');
      expect(url).not.toContain('userId');
    });
  });
});
