/**
 * Payment Processing API Routes
 * Handles Mercado Pago integration, Pix QR codes, and manual payment logging
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 12.1, 12.4
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { PaymentGatewayService, type PaymentProcessingRequest } from '../services/payment-gateway';
import { PixGenerator } from '../services/pix-generator';
import { ManualPaymentLogger } from '../services/manual-payment-logger';
import { SplitPaymentManager, createSplitPaymentManager } from '../services/split-payment-manager';
import { PaymentMethod, PaymentStatus } from '../db/schema';
import { getDb } from '../db';
import { authenticate, injectTenantContext, requireRole } from '../middleware/auth';
import { UserRole } from '../db/schema';

const app = new Hono();

// Apply authentication and tenant context to all routes
app.use('*', authenticate());
app.use('*', injectTenantContext());

// Validation schemas
const processPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive(),
  method: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD']),
  description: z.string().min(1).max(500),
  customerEmail: z.string().email(),
  externalReference: z.string().optional(),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
  issuerId: z.string().optional()
});

const generatePixSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().int().positive(),
  description: z.string().min(1).max(500),
  customerEmail: z.string().email(),
  externalReference: z.string().optional()
});

const manualPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['MANUAL_CARD', 'CASH']),
  amount: z.number().int().positive(),
  referenceNumber: z.string().min(3).max(50),
  processedBy: z.string().uuid(),
  notes: z.string().max(500).optional()
});

const configureGatewaySchema = z.object({
  provider: z.literal('MERCADO_PAGO'),
  accessToken: z.string().min(1),
  publicKey: z.string().min(1),
  webhookUrl: z.string().url().optional()
});

const webhookSchema = z.object({
  action: z.string(),
  api_version: z.string(),
  data: z.object({
    id: z.string()
  }),
  date_created: z.string(),
  id: z.number(),
  live_mode: z.boolean(),
  type: z.string(),
  user_id: z.string()
});

// Split payment schemas
const initializeSplitPaymentSchema = z.object({
  orderId: z.string().uuid()
});

const processSplitPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'MANUAL_CARD', 'CASH']),
  amount: z.number().int().positive(),
  processedBy: z.string().uuid(),
  customerEmail: z.string().email().optional(),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
  issuerId: z.string().optional(),
  notes: z.string().max(500).optional()
});

// Process payment (Pix, Credit Card, Debit Card)
app.post('/process', zValidator('json', processPaymentSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const request: PaymentProcessingRequest = {
      orderId: body.orderId,
      amount: body.amount,
      method: body.method as PaymentMethod,
      description: body.description,
      customerEmail: body.customerEmail,
      externalReference: body.externalReference,
      cardToken: body.cardToken,
      installments: body.installments,
      issuerId: body.issuerId
    };

    const result = await gatewayService.processPayment(tenantId, request);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      payment: {
        id: result.paymentId,
        gatewayTransactionId: result.gatewayTransactionId,
        status: result.status,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        ticketUrl: result.ticketUrl,
        expirationDate: result.expirationDate
      }
    }, 201);
  } catch (error) {
    console.error('Error processing payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Generate Pix QR Code
app.post('/pix/generate', zValidator('json', generatePixSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const pixGenerator = new PixGenerator(db, gatewayService);

    const result = await pixGenerator.generatePixQRCode(
      tenantId,
      body.orderId,
      body.amount,
      body.description,
      body.customerEmail,
      body.externalReference
    );

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      pix: {
        paymentId: result.paymentId,
        qrCode: result.qrCode,
        qrCodeBase64: result.qrCodeBase64,
        ticketUrl: result.ticketUrl,
        expirationDate: result.expirationDate,
        transactionId: result.transactionId
      }
    }, 201);
  } catch (error) {
    console.error('Error generating Pix QR code:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Validate Pix QR Code
app.get('/pix/:paymentId/validate', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const paymentId = c.req.param('paymentId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const pixGenerator = new PixGenerator(db, gatewayService);

    const result = await pixGenerator.validatePixQRCode(tenantId, paymentId);

    return c.json({
      success: true,
      validation: result
    });
  } catch (error) {
    console.error('Error validating Pix QR code:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get Pix payment status
app.get('/pix/:paymentId/status', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const paymentId = c.req.param('paymentId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const pixGenerator = new PixGenerator(db, gatewayService);

    const result = await pixGenerator.getPixPaymentStatus(tenantId, paymentId);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      status: {
        paymentId: result.paymentId,
        status: result.status,
        isExpired: result.isExpired,
        expirationDate: result.expirationDate,
        gatewayTransactionId: result.gatewayTransactionId,
        processedAt: result.processedAt
      }
    });
  } catch (error) {
    console.error('Error getting Pix payment status:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Log manual payment
app.post('/manual', zValidator('json', manualPaymentSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const manualPaymentLogger = new ManualPaymentLogger(db);

    const result = await manualPaymentLogger.logPayment(tenantId, {
      orderId: body.orderId,
      method: body.method as PaymentMethod,
      amount: body.amount,
      referenceNumber: body.referenceNumber,
      processedBy: body.processedBy,
      notes: body.notes
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      payment: {
        id: result.paymentId,
        orderId: result.orderId,
        amount: result.amount,
        status: result.status
      }
    }, 201);
  } catch (error) {
    console.error('Error logging manual payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get manual payment audit trail
app.get('/manual/audit', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.query('orderId');

    const db = getDb(c.env);
    const manualPaymentLogger = new ManualPaymentLogger(db);

    const auditTrail = await manualPaymentLogger.getAuditTrail(tenantId, orderId);

    return c.json({
      success: true,
      auditTrail
    });
  } catch (error) {
    console.error('Error getting manual payment audit trail:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get payment history for an order
app.get('/order/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const pixGenerator = new PixGenerator(db, gatewayService);
    const manualPaymentLogger = new ManualPaymentLogger(db);

    // Get Pix payments
    const pixPayments = await pixGenerator.getPixPaymentsForOrder(tenantId, orderId);
    
    // Get manual payment history
    const manualPayments = await manualPaymentLogger.getPaymentHistory(tenantId, orderId);

    return c.json({
      success: true,
      payments: {
        pix: pixPayments.success ? pixPayments.payments : [],
        manual: manualPayments
      }
    });
  } catch (error) {
    console.error('Error getting payment history:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Configure payment gateway
app.post('/gateway/configure', zValidator('json', configureGatewaySchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const result = await gatewayService.configureGateway(
      tenantId,
      body.provider,
      body.accessToken,
      body.publicKey,
      body.webhookUrl
    );

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true,
      configId: result.configId
    }, 201);
  } catch (error) {
    console.error('Error configuring payment gateway:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Validate payment gateway credentials
app.get('/gateway/validate', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const result = await gatewayService.validateConfiguration(tenantId);

    return c.json({
      success: true,
      validation: result
    });
  } catch (error) {
    console.error('Error validating payment gateway:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Check if payment gateway is available
app.get('/gateway/available', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const isAvailable = await gatewayService.isGatewayAvailable(tenantId);

    return c.json({
      success: true,
      available: isAvailable
    });
  } catch (error) {
    console.error('Error checking payment gateway availability:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Deactivate payment gateway
app.delete('/gateway', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const result = await gatewayService.deactivateGateway(tenantId);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true
    });
  } catch (error) {
    console.error('Error deactivating payment gateway:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Webhook endpoint for Mercado Pago notifications
app.post('/webhook', zValidator('json', webhookSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    
    // Extract tenant ID from external reference or header
    const tenantId = c.req.header('X-Tenant-ID') || c.get('tenantId') as string;
    
    if (!tenantId) {
      return c.json({
        success: false,
        error: 'Tenant ID required'
      }, 400);
    }

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    // Handle the webhook notification
    const result = await gatewayService.handleWebhook(tenantId, body);

    return c.json({
      success: true,
      processed: result
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// Cancel payment
app.post('/:paymentId/cancel', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const paymentId = c.req.param('paymentId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const result = await gatewayService.cancelPayment(tenantId, paymentId);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true,
      status: result.status
    });
  } catch (error) {
    console.error('Error cancelling payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Refund payment
app.post('/:paymentId/refund', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const paymentId = c.req.param('paymentId');
    const body = await c.req.json().catch(() => ({}));
    const refundAmount = body.refundAmount as number | undefined;

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);

    const result = await gatewayService.refundPayment(tenantId, paymentId, refundAmount);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true,
      refund: result.refund
    });
  } catch (error) {
    console.error('Error refunding payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get payment summary for an order
app.get('/summary/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const manualPaymentLogger = new ManualPaymentLogger(db);

    const summary = await manualPaymentLogger.getPaymentSummary(tenantId, orderId);

    return c.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error getting payment summary:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// ============================================
// Split Payment Endpoints
// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
// ============================================

// Initialize split payment for an order
app.post('/split/initialize', zValidator('json', initializeSplitPaymentSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const result = await splitPaymentManager.initializeSplitPayment(tenantId, body.orderId);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true,
      splitPaymentId: result.splitPaymentId
    }, 201);
  } catch (error) {
    console.error('Error initializing split payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Process a partial payment (supports mixed payment methods)
app.post('/split/process', zValidator('json', processSplitPaymentSchema), async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = c.req.valid('json');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const result = await splitPaymentManager.processPayment(tenantId, {
      orderId: body.orderId,
      method: body.method as PaymentMethod,
      amount: body.amount,
      processedBy: body.processedBy,
      customerEmail: body.customerEmail,
      cardToken: body.cardToken,
      installments: body.installments,
      issuerId: body.issuerId,
      notes: body.notes
    });

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error,
        errorCode: result.errorCode
      }, 400);
    }

    return c.json({
      success: true,
      payment: {
        id: result.paymentId,
        splitPaymentId: result.splitPaymentId,
        balanceInfo: result.balanceInfo,
        changeAmount: result.changeAmount
      }
    }, 201);
  } catch (error) {
    console.error('Error processing split payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get real-time balance information for an order
app.get('/split/balance/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const balanceInfo = await splitPaymentManager.getBalanceInfo(tenantId, orderId);

    if (!balanceInfo) {
      return c.json({
        success: false,
        error: 'Order not found'
      }, 404);
    }

    return c.json({
      success: true,
      balance: balanceInfo
    });
  } catch (error) {
    console.error('Error getting split payment balance:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get split payment status for an order
app.get('/split/status/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const status = await splitPaymentManager.getSplitPaymentStatus(tenantId, orderId);

    if (!status) {
      return c.json({
        success: false,
        error: 'Split payment not found'
      }, 404);
    }

    return c.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting split payment status:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Check if order can be completed (fully paid)
app.get('/split/can-complete/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const canComplete = await splitPaymentManager.canCompleteOrder(tenantId, orderId);

    return c.json({
      success: true,
      canComplete
    });
  } catch (error) {
    console.error('Error checking order completion:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Get payment history for an order (split payments)
app.get('/split/history/:orderId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const orderId = c.req.param('orderId');

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const history = await splitPaymentManager.getPaymentHistory(tenantId, orderId);

    return c.json({
      success: true,
      payments: history
    });
  } catch (error) {
    console.error('Error getting split payment history:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

// Cancel a pending split payment
app.post('/split/cancel/:paymentId', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const paymentId = c.req.param('paymentId');
    const body = await c.req.json().catch(() => ({}));
    const cancelledBy = body.cancelledBy as string;

    if (!cancelledBy) {
      return c.json({
        success: false,
        error: 'cancelledBy user ID is required'
      }, 400);
    }

    const db = getDb(c.env);
    const gatewayService = new PaymentGatewayService(db);
    const splitPaymentManager = createSplitPaymentManager(db, gatewayService);

    const result = await splitPaymentManager.cancelPayment(tenantId, paymentId, cancelledBy);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 400);
    }

    return c.json({
      success: true
    });
  } catch (error) {
    console.error('Error cancelling split payment:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      errorCode: 'INTERNAL_ERROR'
    }, 500);
  }
});

export default app;