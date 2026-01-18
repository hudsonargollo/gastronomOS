import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createJWTService, IJWTService } from './services/jwt';
import { validateJWTConfig } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import userRoutes from './routes/users';
import locationRoutes from './routes/locations';
import supplierRoutes from './routes/suppliers';
import purchaseOrderRoutes from './routes/purchase-orders';
import priceHistoryRoutes from './routes/price-history';
import auditRoutes from './routes/audit';
import productRoutes from './routes/products';
import purchasingAnalyticsRoutes from './routes/purchasing-analytics';
import receiptRoutes from './routes/receipts';
import secureReceiptRoutes from './routes/secure-receipts';
import qualityControlRoutes from './routes/quality-control';
import poIntegrationRoutes from './routes/po-integration';
import poAllocationIntegrationRoutes from './routes/po-allocation-integration';
import varianceReportsRoutes from './routes/variance-reports';
import transferRoutes from './routes/transfers';
import transferNotificationRoutes from './routes/transfer-notifications';
import emergencyTransferRoutes from './routes/emergency-transfers';
import allocationRoutes from './routes/allocations';
import allocationAuditRoutes from './routes/allocation-audit';
import allocationAnalyticsRoutes from './routes/allocation-analytics';
import allocationOptimizerRoutes from './routes/allocation-optimizer';
import unallocatedInventoryRoutes from './routes/unallocated-inventory';
import transferAnalyticsRoutes from './routes/transfer-analytics';
import receiptAnalyticsRoutes from './routes/receipt-analytics';
import allocationTransferIntegrationRoutes from './routes/allocation-transfer-integration';
import transferOptimizationRoutes from './routes/transfer-optimization';
import transferIntelligenceRoutes from './routes/transfer-intelligence';
import { handleReceiptProcessingQueue, type ReceiptProcessingJobMessage } from './services/receipt-processor';

// Environment bindings interface
export interface Env extends Record<string, unknown> {
  DB: D1Database;
  JWT_SECRET: string;
  BCRYPT_ROUNDS?: string;
  ENVIRONMENT?: string;
  RECEIPT_BUCKET?: R2Bucket;
  RECEIPT_QUEUE?: Queue;
  AI?: Ai;
}

// Extend Hono context with JWT service
type Variables = {
  jwtService: IJWTService;
};

// Initialize Hono app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global error handler (must be first)
app.use('*', errorHandler());

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://app.gastronomos.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// JWT service initialization middleware
app.use('*', async (c, next) => {
  try {
    // Validate JWT configuration on startup
    validateJWTConfig(c.env.JWT_SECRET, c.env.ENVIRONMENT);
    
    // Create JWT service instance and attach to context
    const jwtService = createJWTService(c.env.JWT_SECRET, c.env.ENVIRONMENT);
    c.set('jwtService', jwtService);
    
    return await next();
  } catch (error) {
    console.error('JWT configuration error:', error);
    return c.json({ 
      error: 'Configuration Error', 
      message: 'JWT service configuration is invalid' 
    }, 500);
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development'
  });
});

// API routes placeholder
app.get('/api/v1', (c) => {
  return c.json({ 
    message: 'GastronomOS Authentication API v1',
    version: '1.0.0'
  });
});

// Mount auth routes
app.route('/auth', authRoutes);

// Mount protected API routes
app.route('/api/v1/tenants', tenantRoutes);
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/locations', locationRoutes);
app.route('/api/v1/suppliers', supplierRoutes);
app.route('/api/v1/purchase-orders', purchaseOrderRoutes);
app.route('/api/v1/transfers', transferRoutes);
app.route('/api/v1/transfer-notifications', transferNotificationRoutes);
app.route('/api/v1/emergency-transfers', emergencyTransferRoutes);
app.route('/api/v1/allocations', allocationRoutes);
app.route('/api/v1', allocationTransferIntegrationRoutes);
app.route('/api/v1', unallocatedInventoryRoutes);
app.route('/api/v1', allocationAuditRoutes);
app.route('/api/v1/allocation-analytics', allocationAnalyticsRoutes);
app.route('/api/v1/allocation-optimizer', allocationOptimizerRoutes);
app.route('/api/v1/transfer-analytics', transferAnalyticsRoutes);
app.route('/api/v1/transfer-optimization', transferOptimizationRoutes);
app.route('/api/v1/transfer-intelligence', transferIntelligenceRoutes);
app.route('/api/v1/purchasing-analytics', purchasingAnalyticsRoutes);
app.route('/api/v1/receipts', receiptRoutes);
app.route('/api/v1/secure-receipts', secureReceiptRoutes);
app.route('/api/v1/receipts', qualityControlRoutes);
app.route('/api/v1', poIntegrationRoutes);
app.route('/api/v1', poAllocationIntegrationRoutes);
app.route('/api/v1/variance-reports', varianceReportsRoutes);
app.route('/api/v1/analytics', receiptAnalyticsRoutes);
app.route('/api/v1', priceHistoryRoutes);
app.route('/api/v1', auditRoutes);
app.route('/api/v1', productRoutes);

// 404 handler for unmatched routes
app.use('*', notFoundHandler());

// Error handler (Hono's onError is still useful for unhandled errors)
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ 
    error: 'Internal Server Error', 
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    request_id: crypto.randomUUID()
  }, 500);
});

export default app;

// Export queue consumer for Cloudflare Workers with error handling
export async function queue(
  batch: MessageBatch<ReceiptProcessingJobMessage>,
  env: Env
): Promise<void> {
  try {
    // Validate required environment bindings
    if (!env.DB) {
      console.error('Queue processing failed: DB binding not available');
      return;
    }
    
    if (!env.RECEIPT_BUCKET) {
      console.error('Queue processing failed: RECEIPT_BUCKET binding not available');
      return;
    }
    
    if (!env.AI) {
      console.error('Queue processing failed: AI binding not available');
      return;
    }

    // Process the queue batch using the receipt processor
    await handleReceiptProcessingQueue(batch, {
      DB: env.DB,
      RECEIPT_BUCKET: env.RECEIPT_BUCKET,
      AI: env.AI
    });

  } catch (error) {
    console.error('Queue processing error:', error);
    
    // Log error details for debugging
    console.error('Queue batch details:', {
      queueName: batch.queue,
      messageCount: batch.messages.length,
      timestamp: new Date().toISOString()
    });
    
    // Acknowledge all messages to prevent infinite retries on system errors
    for (const message of batch.messages) {
      try {
        message.ack();
      } catch (ackError) {
        console.error('Failed to acknowledge message:', ackError);
      }
    }
  }
}

// Export the receipt processing queue handler for direct use
export { handleReceiptProcessingQueue };