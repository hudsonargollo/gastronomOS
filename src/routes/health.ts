/**
 * Health Check API Routes
 * Provides health check endpoints for system monitoring
 * 
 * Validates: Requirement 15.5
 */

import { Hono } from 'hono';
import { SystemHealthMonitoringService } from '../services/system-health-monitoring';

export function createHealthRoutes(healthService: SystemHealthMonitoringService) {
  const app = new Hono();

  /**
   * GET /health
   * Get overall system health status
   */
  app.get('/', async (c) => {
    try {
      const health = healthService.getSystemHealth();
      
      const statusCode = health.overall === 'healthy' ? 200 :
                        health.overall === 'degraded' ? 200 : 503;

      return c.json(health, statusCode);
    } catch (error) {
      return c.json({
        overall: 'unhealthy',
        error: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      }, 503);
    }
  });

  /**
   * GET /health/services/:service
   * Get health status for a specific service
   */
  app.get('/services/:service', async (c) => {
    try {
      const service = c.req.param('service');
      const serviceHealth = healthService.getServiceHealth(service);

      if (!serviceHealth) {
        return c.json({
          error: 'Service not found',
          service
        }, 404);
      }

      const statusCode = serviceHealth.status === 'healthy' ? 200 :
                        serviceHealth.status === 'degraded' ? 200 : 503;

      return c.json(serviceHealth, statusCode);
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : 'Service health check failed'
      }, 500);
    }
  });

  /**
   * GET /health/alerts
   * Get active health alerts
   */
  app.get('/alerts', async (c) => {
    try {
      const severity = c.req.query('severity') as 'info' | 'warning' | 'critical' | undefined;
      
      const alerts = severity 
        ? healthService.getAlertsBySeverity(severity)
        : healthService.getActiveAlerts();

      return c.json({
        alerts,
        count: alerts.length,
        timestamp: Date.now()
      });
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : 'Failed to get alerts'
      }, 500);
    }
  });

  /**
   * GET /health/liveness
   * Simple liveness probe for container orchestration
   */
  app.get('/liveness', (c) => {
    return c.json({
      status: 'alive',
      timestamp: Date.now()
    });
  });

  /**
   * GET /health/readiness
   * Readiness probe - checks if system can handle requests
   */
  app.get('/readiness', async (c) => {
    try {
      const health = healthService.getSystemHealth();
      
      if (health.overall === 'unhealthy') {
        return c.json({
          status: 'not-ready',
          reason: 'System is unhealthy',
          timestamp: Date.now()
        }, 503);
      }

      return c.json({
        status: 'ready',
        timestamp: Date.now()
      });
    } catch (error) {
      return c.json({
        status: 'not-ready',
        reason: error instanceof Error ? error.message : 'Health check failed',
        timestamp: Date.now()
      }, 503);
    }
  });

  return app;
}
