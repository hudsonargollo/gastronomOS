/**
 * System Health Routes
 * Provides endpoints for health checks and system status
 * 
 * Requirements: All system integration requirements
 */

import { Hono } from 'hono';
import { getSystemIntegrator } from '../services/system-integration';

const router = new Hono();

/**
 * GET /api/v1/system/health
 * Basic health check endpoint
 */
router.get('/health', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const status = await integrator.checkHealth();
    
    const statusCode = status.healthy ? 200 : 503;
    
    return c.json({
      status: status.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: status.uptime,
      services: status.services,
      database: status.database,
      config: {
        valid: status.config.valid,
        errorCount: status.config.errors.length,
      },
    }, statusCode);
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/health/detailed
 * Detailed health report with all services
 */
router.get('/health/detailed', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const report = await integrator.getDetailedHealthReport();
    
    // Convert services map to object for JSON
    const services: Record<string, any> = {};
    for (const [key, value] of report.services) {
      services[key] = value;
    }
    
    const statusCode = report.status.healthy ? 200 : 503;
    
    return c.json({
      status: report.status.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: report.status.uptime,
      services,
      database: report.database,
      config: report.config,
    }, statusCode);
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/health/services
 * Health status of all services
 */
router.get('/health/services', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const discovery = integrator.getDiscovery();
    const healthMap = await discovery.performAllHealthChecks();
    
    const services: Record<string, any> = {};
    for (const [key, value] of healthMap) {
      services[key] = value;
    }
    
    return c.json({
      timestamp: new Date().toISOString(),
      services,
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Service health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/health/database
 * Database health and statistics
 */
router.get('/health/database', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const dbPool = integrator.getDbPool();
    
    const [health, stats, size, tables] = await Promise.all([
      dbPool.checkHealth(),
      dbPool.getStats(),
      dbPool.getDatabaseSize(),
      dbPool.getTableStats(),
    ]);
    
    return c.json({
      timestamp: new Date().toISOString(),
      health: {
        connected: health.healthy,
        latency: health.latency,
        error: health.error,
      },
      pool: stats,
      size,
      tables,
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Database health check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/config
 * System configuration (safe, without secrets)
 */
router.get('/config', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const configManager = integrator.getConfigManager();
    const validation = configManager.validate();
    
    return c.json({
      timestamp: new Date().toISOString(),
      valid: validation.valid,
      errors: validation.errors,
      config: configManager.getSafeConfig(),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Config check failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/services
 * List all registered services
 */
router.get('/services', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const discovery = integrator.getDiscovery();
    const services = discovery.getAllServices();
    
    return c.json({
      timestamp: new Date().toISOString(),
      count: services.length,
      services: services.map(s => ({
        identifier: s.identifier,
        name: s.name,
        description: s.description,
        version: s.version,
        tags: s.tags,
        dependencies: s.dependencies,
        healthStatus: s.healthStatus,
      })),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Service discovery failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/services/:id
 * Get details of a specific service
 */
router.get('/services/:id', async (c) => {
  try {
    const serviceId = c.req.param('id') as any;
    const integrator = getSystemIntegrator();
    const discovery = integrator.getDiscovery();
    
    const metadata = discovery.getServiceMetadata(serviceId);
    if (!metadata) {
      return c.json({
        status: 'error',
        message: `Service '${serviceId}' not found`,
        timestamp: new Date().toISOString(),
      }, 404);
    }
    
    const health = await discovery.isServiceHealthy(serviceId);
    const dependents = discovery.getDependentServices(serviceId);
    
    return c.json({
      timestamp: new Date().toISOString(),
      service: {
        ...metadata,
        isHealthy: health,
        dependents,
      },
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Service lookup failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * POST /api/v1/system/database/optimize
 * Trigger database optimization
 */
router.post('/database/optimize', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const dbPool = integrator.getDbPool();
    
    await dbPool.optimize();
    
    return c.json({
      status: 'success',
      message: 'Database optimization completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Database optimization failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

/**
 * GET /api/v1/system/metrics/queries
 * Get query performance metrics
 */
router.get('/metrics/queries', async (c) => {
  try {
    const integrator = getSystemIntegrator();
    const dbPool = integrator.getDbPool();
    
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const slowThreshold = parseInt(c.req.query('slowThreshold') || '1000', 10);
    
    const metrics = dbPool.getQueryMetrics(limit);
    const slowQueries = dbPool.getSlowQueries(slowThreshold);
    const failedQueries = dbPool.getFailedQueries();
    
    return c.json({
      timestamp: new Date().toISOString(),
      total: metrics.length,
      slowQueries: slowQueries.length,
      failedQueries: failedQueries.length,
      metrics: metrics.slice(0, limit),
    });
  } catch (error) {
    return c.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Query metrics failed',
      timestamp: new Date().toISOString(),
    }, 500);
  }
});

export default router;