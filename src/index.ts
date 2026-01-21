import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { createJWTService, IJWTService } from './services/jwt';
import { validateJWTConfig } from './config';
import { errorHandler, notFoundHandler } from './middleware/error';
import { createRateLimit, ipRateLimit } from './middleware/rate-limit';
import { inputValidationMiddleware } from './services/data-sanitization';
import { versionDetectionMiddleware, versionCompatibilityMiddleware, responseTransformationMiddleware } from './services/api-versioning';
import { ApiMonitoringService, requestMetricsMiddleware, createHealthCheckHandler, createMetricsHandler } from './services/api-monitoring';
import { CacheService, cacheMiddleware } from './services/caching';
import { ScheduledJobsService } from './services/scheduled-jobs';
import { WebhookSystemService } from './services/webhook-system';
import { ComprehensiveAuditService } from './services/comprehensive-audit';
import categoryRoutes from './routes/categories';
import inventoryRoutes from './routes/inventory';
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
import demoRoutes from './routes/demo';
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
  REDIS_URL?: string;
  WEBHOOK_SECRET?: string;
}

// Extend Hono context with services
type Variables = {
  jwtService: IJWTService;
  monitoringService: ApiMonitoringService;
  cacheService: CacheService;
  auditService: ComprehensiveAuditService;
  webhookService: WebhookSystemService;
  scheduledJobsService: ScheduledJobsService;
};

// Initialize services
let monitoringService: ApiMonitoringService;
let cacheService: CacheService;
let auditService: ComprehensiveAuditService;
let webhookService: WebhookSystemService;
let scheduledJobsService: ScheduledJobsService;

// Initialize Hono app
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Initialize services
function initializeServices(env: Env) {
  try {
    if (!monitoringService) {
      monitoringService = new ApiMonitoringService();
    }
    
    if (!cacheService) {
      cacheService = new CacheService({
        memory: { maxSize: 10000, maxMemory: 100 * 1024 * 1024 },
        redis: undefined, // Disable Redis for now
      });
    }
    
    if (!auditService && env.DB) {
      auditService = new ComprehensiveAuditService(env.DB);
    }
    
    if (!webhookService) {
      webhookService = new WebhookSystemService();
    }
    
    if (!scheduledJobsService) {
      scheduledJobsService = new ScheduledJobsService();
    }
  } catch (error) {
    console.error('Service initialization error:', error);
    // Continue with basic functionality even if some services fail
  }
}

// Global error handler (must be first)
app.use('*', errorHandler());

// Initialize services middleware
app.use('*', async (c, next) => {
  try {
    initializeServices(c.env);
    
    // Attach services to context (with fallbacks)
    c.set('monitoringService', monitoringService || new ApiMonitoringService());
    c.set('cacheService', cacheService || new CacheService({ memory: { maxSize: 1000 } }));
    c.set('auditService', auditService);
    c.set('webhookService', webhookService);
    c.set('scheduledJobsService', scheduledJobsService);
    
    await next();
  } catch (error) {
    console.error('Middleware initialization error:', error);
    await next();
  }
});

// API versioning middleware
app.use('/api/*', versionDetectionMiddleware());
app.use('/api/*', versionCompatibilityMiddleware());

// Request monitoring middleware (conditional)
app.use('*', async (c, next) => {
  try {
    const monitoring = c.get('monitoringService');
    if (monitoring) {
      return requestMetricsMiddleware(monitoring)(c, next);
    }
  } catch (error) {
    console.error('Monitoring middleware error:', error);
  }
  await next();
});

// Input validation and sanitization middleware (conditional)
app.use('/api/*', async (c, next) => {
  try {
    return inputValidationMiddleware()(c, next);
  } catch (error) {
    console.error('Validation middleware error:', error);
    await next();
  }
});

// Caching middleware for GET requests (conditional)
app.use('/api/*', async (c, next) => {
  try {
    const cache = c.get('cacheService');
    if (cache) {
      return cacheMiddleware(cache, {
        defaultTTL: 300, // 5 minutes
        shouldCache: (c) => c.req.method === 'GET' && !c.req.path.includes('/auth/'),
      })(c, next);
    }
  } catch (error) {
    console.error('Cache middleware error:', error);
  }
  await next();
});

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: [
    'http://localhost:3000', 
    'https://app.gastronomos.com',
    'https://gastronomos.clubemkt.digital',
    'https://dbdbf0a5.gastronomos-frontend.pages.dev',
    'https://fdfed44d.gastronomos-frontend.pages.dev',
    'https://46e0e617.gastronomos-frontend.pages.dev',
    'https://d4d079d5.gastronomos-frontend.pages.dev',
    'https://dac868cd.gastronomos-frontend.pages.dev',
    'https://6bf8e242.gastronomos-frontend.pages.dev',
    'https://a3facd51.gastronomos-frontend.pages.dev',
    'https://gastronomos-frontend.pages.dev'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 86400, // 24 hours
}));

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  
  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  c.header('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // Rate limiting headers (basic implementation)
  const rateLimitInfo = c.get('rateLimitInfo');
  if (rateLimitInfo) {
    c.header('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    c.header('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    c.header('X-RateLimit-Reset', rateLimitInfo.reset.toString());
  }
});

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
app.get('/health', async (c) => {
  try {
    const monitoring = c.get('monitoringService');
    if (monitoring) {
      return createHealthCheckHandler(monitoring)(c);
    } else {
      // Fallback health check
      const result = await c.env.DB.prepare('SELECT 1 as test').first();
      return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: c.env?.ENVIRONMENT || 'development',
        database: result ? 'connected' : 'disconnected',
        jwt_configured: !!c.env.JWT_SECRET
      });
    }
  } catch (error) {
    console.error('Health check endpoint:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Public demo credentials endpoint (no authentication required)
app.get('/api/v1/demo/credentials', async (c) => {
  try {
    const demoAccounts = [
      {
        role: 'admin',
        email: 'demo@gastronomos.com',
        password: 'demo123',
        description: 'Full system access with all permissions'
      },
      {
        role: 'manager',
        email: 'manager@demo-restaurant.com',
        password: 'manager123',
        description: 'Location manager with inventory and purchasing access'
      },
      {
        role: 'staff',
        email: 'staff@demo-restaurant.com',
        password: 'staff123',
        description: 'Basic staff access for inventory viewing'
      }
    ];

    return c.json({
      success: true,
      data: {
        accounts: demoAccounts,
        defaultAccount: demoAccounts[0],
        message: 'Demo credentials retrieved successfully'
      }
    }, 200);
  } catch (error) {
    console.error('Error retrieving demo credentials:', error);
    return c.json({
      error: 'Demo Credentials Error',
      message: 'Unable to retrieve demo credentials'
    }, 500);
  }
});

// Metrics endpoint
app.get('/metrics', (c) => createMetricsHandler(monitoringService)(c));

// API status endpoint
app.get('/api/status', async (c) => {
  const stats = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: c.env?.ENVIRONMENT || 'development',
    services: {
      monitoring: monitoringService.getSystemMetrics(),
      cache: cacheService.getStats(),
      webhooks: webhookService ? {
        totalEndpoints: webhookService.getWebhooks('system').length,
      } : null,
      scheduledJobs: scheduledJobsService ? scheduledJobsService.getJobStats() : null,
    },
  };
  
  return c.json(stats);
});

// Demo test endpoint
app.get('/api/v1/demo-test', async (c) => {
  return c.json({
    message: 'Demo test endpoint working',
    timestamp: new Date().toISOString(),
    demo: {
      credentials: {
        email: 'demo@gastronomos.com',
        password: 'demo123'
      }
    }
  });
});

// API routes placeholder
app.get('/api/v1', (c) => {
  return c.json({ 
    message: 'GastronomOS Advanced Backend API v1',
    version: '1.0.0',
    features: [
      'Comprehensive pagination and filtering',
      'Bulk operations',
      'Advanced data export',
      'Comprehensive audit logging',
      'API versioning',
      'Full-text search',
      'Caching',
      'Webhook system',
      'Scheduled jobs',
      'Monitoring and health checks',
    ],
  });
});

// Mount auth routes with strict rate limiting
app.use('/api/v1/auth/*', createRateLimit('auth'));
app.route('/api/v1/auth', authRoutes);

// Apply general API rate limiting to all protected routes
app.use('/api/v1/*', createRateLimit('api'));

// Response transformation middleware (for API versioning)
app.use('/api/*', responseTransformationMiddleware());

// Mount protected API routes
app.route('/api/v1/categories', categoryRoutes);
app.route('/api/v1/inventory', inventoryRoutes);
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
app.route('/api/v1/demo', demoRoutes);

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