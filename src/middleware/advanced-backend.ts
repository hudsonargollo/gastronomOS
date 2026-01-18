import { Context, MiddlewareHandler } from 'hono';
import { ApiMonitoringService } from '../services/api-monitoring';
import { CacheService } from '../services/caching';
import { ComprehensiveAuditService } from '../services/comprehensive-audit';
import { WebhookSystemService } from '../services/webhook-system';
import { ScheduledJobsService } from '../services/scheduled-jobs';
import { BackupRestoreService } from '../services/backup-restore';
import { DataSanitizationService } from '../services/data-sanitization';

/**
 * Advanced Backend Middleware
 * Integrates all advanced backend services
 */

/**
 * Performance monitoring middleware
 */
export function performanceMonitoringMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const startTime = Date.now();
    const monitoringService = c.get('monitoringService') as ApiMonitoringService;
    
    // Add request ID
    const requestId = crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-ID', requestId);
    
    await next();
    
    // Record performance metrics
    const duration = Date.now() - startTime;
    
    // Add performance headers
    c.header('X-Response-Time', `${duration}ms`);
    c.header('Server-Timing', `total;dur=${duration}`);
    
    // Log slow requests
    if (duration > 2000) {
      console.warn(`Slow request detected: ${c.req.method} ${c.req.path} took ${duration}ms`);
    }
  };
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
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
    
    // HSTS header for HTTPS
    if (c.req.header('X-Forwarded-Proto') === 'https') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
  };
}

/**
 * Request sanitization middleware
 */
export function requestSanitizationMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    try {
      // Sanitize query parameters
      const query = c.req.query();
      const sanitizedQuery: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(query)) {
        const sanitizationResult = DataSanitizationService.sanitizeString(value, {
          maxLength: 1000,
          allowHtml: false,
        });
        
        if (sanitizationResult.isValid) {
          sanitizedQuery[key] = sanitizationResult.sanitizedValue;
        } else {
          console.warn(`Invalid query parameter ${key}:`, sanitizationResult.errors);
        }
      }
      
      c.set('sanitizedQuery', sanitizedQuery);
      
      await next();
    } catch (error) {
      console.error('Request sanitization error:', error);
      return c.json({
        error: 'Bad Request',
        message: 'Invalid request parameters',
      }, 400);
    }
  };
}

/**
 * Audit logging middleware
 */
export function auditLoggingMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const auditService = c.get('auditService') as ComprehensiveAuditService;
    const authContext = c.get('authContext');
    
    // Log request start
    const startTime = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';
    
    await next();
    
    // Log request completion
    const duration = Date.now() - startTime;
    const statusCode = c.res.status;
    
    // Log significant events
    if (method !== 'GET' && authContext) {
      await auditService?.logEvent(
        authContext.tenant_id,
        'API_REQUEST',
        {
          userId: authContext.user_id,
          resource: path,
          action: method.toLowerCase(),
          ipAddress,
          userAgent,
          metadata: {
            statusCode,
            duration,
            requestId: c.get('requestId'),
          },
        }
      );
    }
    
    // Log security events
    if (statusCode === 401 || statusCode === 403) {
      await auditService?.logSecurityEvent(
        'ACCESS_DENIED',
        authContext?.tenant_id || 'unknown',
        authContext?.user_id,
        ipAddress,
        userAgent,
        {
          path,
          method,
          statusCode,
        }
      );
    }
  };
}

/**
 * Cache invalidation middleware
 */
export function cacheInvalidationMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const cacheService = c.get('cacheService') as CacheService;
    const authContext = c.get('authContext');
    const method = c.req.method;
    const path = c.req.path;
    
    await next();
    
    // Invalidate cache for write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && authContext) {
      const pathSegments = path.split('/');
      const resource = pathSegments[pathSegments.length - 1] || pathSegments[pathSegments.length - 2];
      
      // Invalidate related cache entries
      await cacheService?.invalidateByTags([
        `tenant:${authContext.tenant_id}`,
        resource,
      ]);
      
      console.log(`Cache invalidated for tenant ${authContext.tenant_id}, resource: ${resource}`);
    }
  };
}

/**
 * Webhook trigger middleware
 */
export function webhookTriggerMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const webhookService = c.get('webhookService') as WebhookSystemService;
    const authContext = c.get('authContext');
    const method = c.req.method;
    const path = c.req.path;
    
    await next();
    
    // Trigger webhooks for successful write operations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && 
        authContext && 
        c.res.status >= 200 && 
        c.res.status < 300) {
      
      const pathSegments = path.split('/');
      const resource = pathSegments[pathSegments.length - 1] || pathSegments[pathSegments.length - 2];
      
      // Map HTTP methods to webhook events
      const eventMap: Record<string, string> = {
        POST: `${resource}.created`,
        PUT: `${resource}.updated`,
        PATCH: `${resource}.updated`,
        DELETE: `${resource}.deleted`,
      };
      
      const eventType = eventMap[method];
      if (eventType) {
        try {
          await webhookService?.triggerEvent(
            authContext.tenant_id,
            eventType,
            {
              resource,
              action: method.toLowerCase(),
              userId: authContext.user_id,
              timestamp: new Date().toISOString(),
              requestId: c.get('requestId'),
            }
          );
        } catch (error) {
          console.error('Webhook trigger error:', error);
          // Don't fail the request if webhook fails
        }
      }
    }
  };
}

/**
 * Response compression middleware
 */
export function responseCompressionMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    await next();
    
    // Add compression hints
    const acceptEncoding = c.req.header('Accept-Encoding') || '';
    
    if (acceptEncoding.includes('gzip')) {
      c.header('Vary', 'Accept-Encoding');
      // Note: Actual compression would be handled by the edge/CDN
      c.header('X-Compression-Available', 'gzip');
    }
    
    // Add content length if available
    const contentLength = c.res.headers.get('Content-Length');
    if (contentLength) {
      c.header('X-Uncompressed-Size', contentLength);
    }
  };
}

/**
 * API analytics middleware
 */
export function apiAnalyticsMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    const startTime = Date.now();
    const authContext = c.get('authContext');
    
    await next();
    
    const duration = Date.now() - startTime;
    const statusCode = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    
    // Collect analytics data
    const analyticsData = {
      timestamp: new Date().toISOString(),
      method,
      path,
      statusCode,
      duration,
      tenantId: authContext?.tenant_id,
      userId: authContext?.user_id,
      userAgent: c.req.header('User-Agent'),
      ipAddress: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      apiVersion: c.get('apiVersion'),
      requestId: c.get('requestId'),
    };
    
    // In a real implementation, you would send this to an analytics service
    console.log('API Analytics:', analyticsData);
    
    // Add analytics headers
    c.header('X-Analytics-Tracked', 'true');
    c.header('X-Request-Duration', `${duration}ms`);
  };
}

/**
 * Health check middleware
 */
export function healthCheckMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    // Skip health checks for health endpoints
    if (c.req.path.includes('/health') || c.req.path.includes('/metrics')) {
      return await next();
    }
    
    const monitoringService = c.get('monitoringService') as ApiMonitoringService;
    
    // Perform basic health check
    const healthCheck = await monitoringService?.performHealthCheck();
    
    if (healthCheck?.status === 'unhealthy') {
      return c.json({
        error: 'Service Unavailable',
        message: 'System is currently unhealthy',
        status: healthCheck.status,
      }, 503);
    }
    
    await next();
  };
}

/**
 * Combine all advanced middleware
 */
export function advancedBackendMiddleware(): MiddlewareHandler[] {
  return [
    securityHeadersMiddleware(),
    performanceMonitoringMiddleware(),
    requestSanitizationMiddleware(),
    auditLoggingMiddleware(),
    cacheInvalidationMiddleware(),
    webhookTriggerMiddleware(),
    responseCompressionMiddleware(),
    apiAnalyticsMiddleware(),
  ];
}