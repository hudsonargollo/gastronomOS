/**
 * Unit tests for PaymentGatewayService
 * Tests Mercado Pago integration, credential management, and payment processing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  PaymentGatewayService, 
  type PaymentProcessingRequest,
  type WebhookNotification
} from './payment-gateway';
import { PaymentMethod, PaymentStatus } from '../db/schema';

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock database
const mockDb = {
  insert: vi.fn().mockReturnValue({ values: vi.fn() }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([])
      })
    })
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue({})
    })
  }),
  query: {
    paymentGatewayConfigs: {
      findFirst: vi.fn().mockResolvedValue(null)
    }
  }
};

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;
  const tenantId = 'tenant-123';
  const testAccessToken = 'TEST-1234567890123456-123456-abcdef1234567890abcdef1234567890-123456789';
  const testPublicKey = 'TEST-abcdef1234-5678-90ab-cdef-1234567890ab';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentGatewayService(mockDb as any, 'test-encryption-key');
  });

  describe('configureGateway', () => {
    it('should configure payment gateway with valid credentials', async () => {
      // Mock successful credential validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'user-123' })
      });

      const result = await service.configureGateway(
        tenantId,
        'MERCADO_PAGO',
        testAccessToken,
        testPublicKey,
        'https://example.com/webhook'
      );

      expect(result.success).toBe(true);
      expect(result.configId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should reject invalid access token format', async () => {
      const result = await service.configureGateway(
        tenantId,
        'MERCADO_PAGO',
        'short-token',
        testPublicKey
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid access token');
    });

    it('should reject invalid public key format', async () => {
      const result = await service.configureGateway(
        tenantId,
        'MERCADO_PAGO',
        testAccessToken,
        'short-key'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid public key');
    });
  });

  describe('getCredentials', () => {
    it('should return null when no credentials configured', async () => {
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(null);

      const result = await service.getCredentials(tenantId);

      expect(result).toBeNull();
    });
  });

  describe('processPayment', () => {
    it('should fail when gateway not configured', async () => {
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(null);

      const request: PaymentProcessingRequest = {
        orderId: 'order-123',
        amount: 5000,
        method: PaymentMethod.PIX,
        description: 'Test payment',
        customerEmail: 'test@example.com'
      };

      const result = await service.processPayment(tenantId, request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment gateway not configured');
      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('should require card token for credit card payments', async () => {
      // Mock credentials
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      const request: PaymentProcessingRequest = {
        orderId: 'order-123',
        amount: 5000,
        method: PaymentMethod.CREDIT_CARD,
        description: 'Test payment',
        customerEmail: 'test@example.com'
      };

      const result = await service.processPayment(tenantId, request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Card token is required');
    });
  });

  describe('validateCredentials', () => {
    it('should validate correct credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'user-123' })
      });

      const result = await service.validateCredentials(testAccessToken, testPublicKey);

      expect(result.isValid).toBe(true);
    });

    it('should reject invalid credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false
      });

      const result = await service.validateCredentials(testAccessToken, testPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid credentials');
    });
  });

  describe('handleWebhook', () => {
    it('should process payment webhook notification', async () => {
      const notification: WebhookNotification = {
        action: 'payment.updated',
        api_version: 'v1',
        data: { id: '123456789' },
        date_created: '2024-01-01T00:00:00Z',
        id: 12345,
        live_mode: false,
        type: 'payment',
        user_id: 'user-123'
      };

      // Mock credentials and payment status
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 123456789,
          status: 'approved',
          status_detail: 'accredited',
          payment_method_id: 'pix',
          transaction_amount: 50.00
        })
      });

      const result = await service.handleWebhook(tenantId, notification);

      expect(result.success).toBe(true);
      expect(result.paymentId).toBe('123456789');
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });

    it('should ignore non-payment notifications', async () => {
      const notification: WebhookNotification = {
        action: 'test',
        api_version: 'v1',
        data: { id: 'test' },
        date_created: '2024-01-01T00:00:00Z',
        id: 12345,
        live_mode: false,
        type: 'other',
        user_id: 'user-123'
      };

      const result = await service.handleWebhook(tenantId, notification);

      expect(result.success).toBe(true);
    });
  });

  describe('isGatewayAvailable', () => {
    it('should return false when no gateway configured', async () => {
      mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(null);

      const result = await service.isGatewayAvailable(tenantId);

      expect(result).toBe(false);
    });

    it('should return true when gateway is configured and active', async () => {
      // Mock getCredentials to return valid credentials
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      const result = await service.isGatewayAvailable(tenantId);

      expect(result).toBe(true);
    });
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return gateway methods when available', async () => {
      vi.spyOn(service, 'isGatewayAvailable').mockResolvedValueOnce(true);

      const result = await service.getAvailablePaymentMethods(tenantId);

      expect(result).toContain(PaymentMethod.PIX);
      expect(result).toContain(PaymentMethod.CREDIT_CARD);
      expect(result).toContain(PaymentMethod.DEBIT_CARD);
    });

    it('should return manual methods when gateway unavailable', async () => {
      vi.spyOn(service, 'isGatewayAvailable').mockResolvedValueOnce(false);

      const result = await service.getAvailablePaymentMethods(tenantId);

      expect(result).toContain(PaymentMethod.MANUAL_CARD);
      expect(result).toContain(PaymentMethod.CASH);
    });
  });

  describe('deactivateGateway', () => {
    it('should deactivate gateway for tenant', async () => {
      const result = await service.deactivateGateway(tenantId);

      expect(result.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a payment', async () => {
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'cancelled' })
      });

      const result = await service.cancelPayment(tenantId, '123456789');

      expect(result.success).toBe(true);
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment', async () => {
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 987654321 })
      });

      const result = await service.refundPayment(tenantId, '123456789');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('987654321');
    });

    it('should support partial refunds', async () => {
      vi.spyOn(service as any, 'getCredentials').mockResolvedValueOnce({
        accessToken: testAccessToken,
        publicKey: testPublicKey,
        isActive: true
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 987654321 })
      });

      const result = await service.refundPayment(tenantId, '123456789', 2500);

      expect(result.success).toBe(true);
    });
  });
});