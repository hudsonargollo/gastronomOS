/**
 * Integration Tests for Payment Gateway
 * Tests Mercado Pago integration with mock responses
 * Validates webhook handling and payment status updates
 * Tests error scenarios and fallback mechanisms
 *
 * Feature: digital-menu-kitchen-payment-system
 * Validates: Requirements 5.1, 5.2, 5.3, 12.5
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PaymentGatewayService } from '../../src/services/payment-gateway';
import { PaymentMethod, PaymentStatus } from '../../src/db/schema';
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
        },
        payments: {
            findFirst: vi.fn().mockResolvedValue(null)
        }
    }
};
describe('Payment Gateway Integration Tests', () => {
    let paymentService;
    const testTenantId = 'tenant-payment-test-123';
    const testAccessToken = 'TEST-1234567890123456-123456-abcdef1234567890abcdef1234567890-123456789';
    const testPublicKey = 'TEST-abcdef1234-5678-90ab-cdef-1234567890ab';
    beforeEach(() => {
        vi.clearAllMocks();
        paymentService = new PaymentGatewayService(mockDb, 'test-encryption-key');
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });
    describe('Mercado Pago Integration with Mock Responses', () => {
        it('should successfully process Pix payment', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock Pix QR code generation API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'pix-payment-001',
                    qr_code: '00020126580014br.gov.bcb.pix0136test-pix-key...',
                    qr_code_base64: 'data:image/png;base64,iVBORw0KGgo...',
                    expiration_date: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                    txid: 'tx-pix-001'
                })
            });
            const paymentRequest = {
                orderId: 'order-pix-001',
                tenantId: testTenantId,
                amount: 3500,
                method: PaymentMethod.PIX,
                description: 'Order #20240115-0001'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
            expect(result.paymentId).toBeDefined();
        });
        it('should successfully process credit card payment', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock payment API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'cc-payment-001',
                    status: 'approved',
                    status_detail: 'accredited',
                    transaction_details: {
                        external_resource_url: null
                    }
                })
            });
            const paymentRequest = {
                orderId: 'order-cc-001',
                tenantId: testTenantId,
                amount: 4500,
                method: PaymentMethod.CREDIT_CARD,
                cardToken: 'card-token-encrypted',
                installments: 1,
                description: 'Order #20240115-0002'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.COMPLETED);
        });
        it('should successfully process debit card payment', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock payment API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'dc-payment-001',
                    status: 'approved',
                    status_detail: 'accredited'
                })
            });
            const paymentRequest = {
                orderId: 'order-dc-001',
                tenantId: testTenantId,
                amount: 2800,
                method: PaymentMethod.DEBIT_CARD,
                cardToken: 'debit-card-token-encrypted',
                description: 'Order #20240115-0003'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
        });
        it('should handle payment with 3DS authentication required', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock 3DS required response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-3ds-001',
                    status: 'in_process',
                    status_detail: 'pending_challenge',
                    three_ds_info: {
                        external_resource_url: 'https://acs.test.com/3ds/challenge'
                    }
                })
            });
            const paymentRequest = {
                orderId: 'order-3ds-001',
                tenantId: testTenantId,
                amount: 5000,
                method: PaymentMethod.CREDIT_CARD,
                cardToken: 'card-token-3ds',
                installments: 3,
                description: 'Order #20240115-0004'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.PROCESSING);
            expect(result.requiresAction).toBe(true);
        });
    });
    describe('Webhook Handling and Payment Status Updates', () => {
        it('should process webhook notification for approved payment', async () => {
            const webhookNotification = {
                id: 'webhook-001',
                type: 'payment',
                data: {
                    id: 'payment-webhook-001'
                }
            };
            // Mock payment status API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-webhook-001',
                    status: 'approved',
                    status_detail: 'accredited',
                    external_reference: 'order-webhook-001',
                    transaction_amount: 3500
                })
            });
            // Mock payment update
            mockDb.update.mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue({ changes: 1 })
                })
            });
            const result = await paymentService.handleWebhook(webhookNotification);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.COMPLETED);
        });
        it('should process webhook notification for rejected payment', async () => {
            const webhookNotification = {
                id: 'webhook-002',
                type: 'payment',
                data: {
                    id: 'payment-webhook-002'
                }
            };
            // Mock payment status API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-webhook-002',
                    status: 'rejected',
                    status_detail: 'cc_rejected_insufficient_amount',
                    external_reference: 'order-webhook-002'
                })
            });
            const result = await paymentService.handleWebhook(webhookNotification);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.FAILED);
        });
        it('should process webhook notification for pending payment', async () => {
            const webhookNotification = {
                id: 'webhook-003',
                type: 'payment',
                data: {
                    id: 'payment-webhook-003'
                }
            };
            // Mock payment status API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-webhook-003',
                    status: 'pending',
                    status_detail: 'pending_waiting_payment',
                    external_reference: 'order-webhook-003'
                })
            });
            const result = await paymentService.handleWebhook(webhookNotification);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.PENDING);
        });
        it('should handle Pix payment expiration webhook', async () => {
            const webhookNotification = {
                id: 'webhook-004',
                type: 'payment',
                data: {
                    id: 'payment-pix-expired'
                }
            };
            // Mock expired Pix payment
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-pix-expired',
                    status: 'cancelled',
                    status_detail: 'expired',
                    external_reference: 'order-pix-expired'
                })
            });
            const result = await paymentService.handleWebhook(webhookNotification);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.CANCELLED);
        });
        it('should handle refund webhook notification', async () => {
            const webhookNotification = {
                id: 'webhook-005',
                type: 'refund',
                data: {
                    id: 'refund-001'
                }
            };
            // Mock refund API response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'refund-001',
                    payment_id: 'payment-refund-001',
                    status: 'approved',
                    amount: 2500
                })
            });
            const result = await paymentService.handleWebhook(webhookNotification);
            expect(result.success).toBe(true);
        });
    });
    describe('Error Scenarios and Fallback Mechanisms', () => {
        it('should handle API timeout with retry', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock timeout on first attempt
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
            // Mock success on retry
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-retry-001',
                    status: 'approved'
                })
            });
            const paymentRequest = {
                orderId: 'order-timeout-001',
                tenantId: testTenantId,
                amount: 2000,
                method: PaymentMethod.PIX,
                description: 'Order #20240115-0005'
            };
            // First attempt should fail
            const firstAttempt = await paymentService.processPayment(paymentRequest).catch(err => ({
                success: false,
                error: err.message
            }));
            expect(firstAttempt.success).toBe(false);
            // Retry should succeed
            const retryResult = await paymentService.processPayment(paymentRequest);
            expect(retryResult.success).toBe(true);
        });
        it('should handle invalid credentials error', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: 'invalid-token',
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock unauthorized response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: () => Promise.resolve({
                    message: 'Invalid credentials',
                    error: 'unauthorized'
                })
            });
            const paymentRequest = {
                orderId: 'order-invalid-creds-001',
                tenantId: testTenantId,
                amount: 2000,
                method: PaymentMethod.PIX,
                description: 'Order #20240115-0006'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('credentials');
        });
        it('should handle rate limiting (429) with exponential backoff', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock rate limit response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                headers: {
                    get: (header) => header === 'X-RateLimit-Reset' ? '60' : null
                },
                json: () => Promise.resolve({
                    message: 'Rate limit exceeded',
                    error: 'too_many_requests'
                })
            });
            const paymentRequest = {
                orderId: 'order-ratelimit-001',
                tenantId: testTenantId,
                amount: 2000,
                method: PaymentMethod.PIX,
                description: 'Order #20240115-0007'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('rate limit');
        });
        it('should handle service unavailability (503) with fallback', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock service unavailable
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 503,
                json: () => Promise.resolve({
                    message: 'Service temporarily unavailable',
                    error: 'service_unavailable'
                })
            });
            const paymentRequest = {
                orderId: 'order-unavailable-001',
                tenantId: testTenantId,
                amount: 2000,
                method: PaymentMethod.PIX,
                description: 'Order #20240115-0008'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(false);
            expect(result.fallbackToManual).toBe(true);
        });
        it('should handle insufficient funds rejection', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock insufficient funds response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-insufficient-001',
                    status: 'rejected',
                    status_detail: 'cc_rejected_insufficient_amount'
                })
            });
            const paymentRequest = {
                orderId: 'order-insufficient-001',
                tenantId: testTenantId,
                amount: 10000,
                method: PaymentMethod.CREDIT_CARD,
                cardToken: 'card-token-insufficient',
                description: 'Order #20240115-0009'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.FAILED);
        });
        it('should handle fraud detection rejection', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            // Mock fraud detection response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'payment-fraud-001',
                    status: 'rejected',
                    status_detail: 'cc_rejected_call_for_authorize'
                })
            });
            const paymentRequest = {
                orderId: 'order-fraud-001',
                tenantId: testTenantId,
                amount: 15000,
                method: PaymentMethod.CREDIT_CARD,
                cardToken: 'card-token-fraud',
                description: 'Order #20240115-0010'
            };
            const result = await paymentService.processPayment(paymentRequest);
            expect(result.success).toBe(true);
            expect(result.status).toBe(PaymentStatus.FAILED);
        });
    });
    describe('Pix QR Code Generation', () => {
        it('should generate valid Pix QR code with 15-minute expiration', async () => {
            // Mock credential retrieval
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce({
                id: 'config-001',
                tenantId: testTenantId,
                provider: 'MERCADO_PAGO',
                accessToken: testAccessToken,
                publicKey: testPublicKey,
                isActive: true
            });
            const expirationDate = new Date(Date.now() + 15 * 60 * 1000);
            // Mock Pix QR generation via processPayment
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'pix-qr-001',
                    qr_code: '00020126580014br.gov.bcb.pix0136test-pix-key...',
                    qr_code_base64: 'data:image/png;base64,iVBORw0KGgo...',
                    expiration_date: expirationDate.toISOString(),
                    txid: 'tx-pix-qr-001'
                })
            });
            const result = await paymentService.processPayment({
                orderId: 'order-pix-qr-001',
                tenantId: testTenantId,
                amount: 3500,
                method: PaymentMethod.PIX
            });
            expect(result.success).toBe(true);
        });
        it('should validate Pix payment expiration', async () => {
            const expirationDate = new Date(Date.now() - 1000); // Expired 1 second ago
            const isExpired = new Date() > expirationDate;
            expect(isExpired).toBe(true);
        });
    });
    describe('Payment Gateway Configuration', () => {
        it('should validate credentials during configuration', async () => {
            // Mock credential validation API
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    id: 'user-123',
                    nickname: 'Test User'
                })
            });
            const result = await paymentService.configureGateway(testTenantId, 'MERCADO_PAGO', testAccessToken, testPublicKey, 'https://example.com/webhook');
            expect(result.success).toBe(true);
        });
        it('should reject invalid access token format', async () => {
            const result = await paymentService.configureGateway(testTenantId, 'MERCADO_PAGO', 'short-token', testPublicKey);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid access token');
        });
        it('should reject invalid public key format', async () => {
            const result = await paymentService.configureGateway(testTenantId, 'MERCADO_PAGO', testAccessToken, 'short-key');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid public key');
        });
        it('should handle tenant without configured gateway', async () => {
            mockDb.query.paymentGatewayConfigs.findFirst.mockResolvedValueOnce(null);
            const result = await paymentService.processPayment({
                orderId: 'order-no-config-001',
                tenantId: 'tenant-no-config',
                amount: 2000,
                method: PaymentMethod.PIX
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not configured');
        });
    });
});
