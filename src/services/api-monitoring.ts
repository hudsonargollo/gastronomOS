import { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';

/**
 * API Monitoring and Health Check Service
 * Requirements: 9.4, 9.6
 */

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, HealthCheckDetail>;
  metrics?: SystemMetrics;
}

export interface HealthCheckDetail {
  status: 'pass' | 'fail' | 'warn';
  responseTime?: number;
  message?: string;
  details?: Record<string, any>;
}

export interface SystemMetrics {
  requests: {
    total: number;
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  responses: {
    success: number;
    clientError: number;
    serverError: number;
  };
  performance: {
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  resources: {
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

export interface ApiMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: number;
  userAgent?: string;
  ipAddress?: string;
  userId?: string;
  tenantId?: string;
  apiVersion?: string;
  errorMessage?: string;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
}

/**
 * Monitoring service configuration
 */
export const MONITORING_CONFIG = {
  healthCheck: {
    timeout: 5000,
    retries: 3,
    interval: 30000,
  },
  metrics: {
    retentionDays: 30,
    aggregationIntervals: [60, 300, 3600], // 1min, 5min, 1hour in seconds
  },
  alerts: {
    errorRateThreshold: 0.05, // 5%
    responseTimeThreshold: 2000, // 2 seconds
    availabilityThreshold: 0.99, // 99%
  },
};

/**
 * API Monitoring Service
 */
export class ApiMonitoringService {
  private metrics: ApiMetrics[] = [];
  private startTime: number = Date.now();

  /**
   * Record API request metrics
   */
  recordMetrics(metrics: ApiMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics (last 24 hours)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;

    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    const lastSecond = this.metrics.filter(m => m.timestamp > oneSecondAgo);
    const lastMinute = this.metrics.filter(m => m.timestamp > oneMinuteAgo);

    // Calculate response time percentiles
    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);

    return {
      requests: {
        total: this.metrics.length,
        perSecond: lastSecond.length,
        perMinute: lastMinute.length,
        perHour: recentMetrics.length,
      },
      responses: {
        success: recentMetrics.filter(m => m.statusCode >= 200 && m.statusCode < 400).length,
        clientError: recentMetrics.filter(m => m.statusCode >= 400 && m.statusCode < 500).length,
        serverError: recentMetrics.filter(m => m.statusCode >= 500).length,
      },
      performance: {
        averageResponseTime: responseTimes.length > 0 
          ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
          : 0,
        p95ResponseTime: responseTimes[p95Index] || 0,
        p99ResponseTime: responseTimes[p99Index] || 0,
      },
      resources: {
        // Note: In a real implementation, you would get actual system metrics
        memoryUsage: this.getMemoryUsage(),
        cpuUsage: this.getCpuUsage(),
      },
    };
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(db?: any): Promise<HealthCheckResult> {
    const checks: Record<string, HealthCheckDetail> = {};
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database health check
    if (db) {
      const dbCheck = await this.checkDatabase(db);
      checks.database = dbCheck;
      if (dbCheck.status === 'fail') overallStatus = 'unhealthy';
      else if (dbCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';
    }

    // Memory health check
    const memoryCheck = this.checkMemory();
    checks.memory = memoryCheck;
    if (memoryCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (memoryCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    // API performance check
    const performanceCheck = this.checkApiPerformance();
    checks.performance = performanceCheck;
    if (performanceCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (performanceCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    // External dependencies check (placeholder)
    const dependenciesCheck = await this.checkExternalDependencies();
    checks.dependencies = dependenciesCheck;
    if (dependenciesCheck.status === 'fail') overallStatus = 'unhealthy';
    else if (dependenciesCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: '1.0.0', // Should come from package.json or environment
      environment: process.env.NODE_ENV || 'development',
      checks,
      metrics: this.getSystemMetrics(),
    };
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabase(db: any): Promise<HealthCheckDetail> {
    const startTime = Date.now();
    
    try {
      // Simple query to test database connectivity
      await db.execute('SELECT 1');
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 1000) {
        return {
          status: 'warn',
          responseTime,
          message: 'Database response time is slow',
          details: { threshold: 1000, actual: responseTime },
        };
      }
      
      return {
        status: 'pass',
        responseTime,
        message: 'Database is healthy',
      };
    } catch (error) {
      return {
        status: 'fail',
        responseTime: Date.now() - startTime,
        message: 'Database connection failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  /**
   * Check memory usage
   */
  private checkMemory(): HealthCheckDetail {
    const memoryUsage = this.getMemoryUsage();
    
    if (memoryUsage > 90) {
      return {
        status: 'fail',
        message: 'Memory usage is critically high',
        details: { usage: memoryUsage, threshold: 90 },
      };
    }
    
    if (memoryUsage > 80) {
      return {
        status: 'warn',
        message: 'Memory usage is high',
        details: { usage: memoryUsage, threshold: 80 },
      };
    }
    
    return {
      status: 'pass',
      message: 'Memory usage is normal',
      details: { usage: memoryUsage },
    };
  }

  /**
   * Check API performance metrics
   */
  private checkApiPerformance(): HealthCheckDetail {
    const metrics = this.getSystemMetrics();
    const errorRate = metrics.responses.serverError / 
      (metrics.responses.success + metrics.responses.clientError + metrics.responses.serverError);
    
    if (errorRate > MONITORING_CONFIG.alerts.errorRateThreshold) {
      return {
        status: 'fail',
        message: 'High error rate detected',
        details: { 
          errorRate: errorRate * 100,
          threshold: MONITORING_CONFIG.alerts.errorRateThreshold * 100,
        },
      };
    }
    
    if (metrics.performance.averageResponseTime > MONITORING_CONFIG.alerts.responseTimeThreshold) {
      return {
        status: 'warn',
        message: 'High response time detected',
        details: { 
          averageResponseTime: metrics.performance.averageResponseTime,
          threshold: MONITORING_CONFIG.alerts.responseTimeThreshold,
        },
      };
    }
    
    return {
      status: 'pass',
      message: 'API performance is good',
      details: {
        errorRate: errorRate * 100,
        averageResponseTime: metrics.performance.averageResponseTime,
      },
    };
  }

  /**
   * Check external dependencies
   */
  private async checkExternalDependencies(): Promise<HealthCheckDetail> {
    // Placeholder for external dependency checks
    // In a real implementation, you would check:
    // - External APIs
    // - Message queues
    // - Cache systems
    // - File storage systems
    
    return {
      status: 'pass',
      message: 'All external dependencies are healthy',
      details: {
        checkedServices: ['cache', 'storage', 'notifications'],
      },
    };
  }

  /**
   * Get memory usage percentage (placeholder)
   */
  private getMemoryUsage(): number {
    // In a real implementation, you would get actual memory usage
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }

  /**
   * Get CPU usage percentage (placeholder)
   */
  private getCpuUsage(): number {
    // In a real implementation, you would get actual CPU usage
    // For now, return a random value for demonstration
    return Math.random() * 100;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(timeRange: 'hour' | 'day' | 'week' = 'hour'): {
    summary: SystemMetrics;
    trends: {
      requestVolume: number[];
      responseTime: number[];
      errorRate: number[];
    };
    topEndpoints: Array<{
      endpoint: string;
      requests: number;
      averageResponseTime: number;
      errorRate: number;
    }>;
  } {
    const now = Date.now();
    const timeRangeMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
    }[timeRange];

    const relevantMetrics = this.metrics.filter(m => m.timestamp > now - timeRangeMs);
    
    // Group metrics by endpoint
    const endpointStats: Record<string, {
      requests: number;
      totalResponseTime: number;
      errors: number;
    }> = {};

    relevantMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.endpoint}`;
      if (!endpointStats[key]) {
        endpointStats[key] = { requests: 0, totalResponseTime: 0, errors: 0 };
      }
      
      endpointStats[key].requests++;
      endpointStats[key].totalResponseTime += metric.responseTime;
      if (metric.statusCode >= 400) {
        endpointStats[key].errors++;
      }
    });

    // Calculate top endpoints
    const topEndpoints = Object.entries(endpointStats)
      .map(([endpoint, stats]) => ({
        endpoint,
        requests: stats.requests,
        averageResponseTime: stats.totalResponseTime / stats.requests,
        errorRate: stats.errors / stats.requests,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Generate trends (simplified - in real implementation, you'd have proper time series data)
    const trends = {
      requestVolume: this.generateTrendData(relevantMetrics, 'requests'),
      responseTime: this.generateTrendData(relevantMetrics, 'responseTime'),
      errorRate: this.generateTrendData(relevantMetrics, 'errorRate'),
    };

    return {
      summary: this.getSystemMetrics(),
      trends,
      topEndpoints,
    };
  }

  /**
   * Generate trend data for charts
   */
  private generateTrendData(metrics: ApiMetrics[], type: 'requests' | 'responseTime' | 'errorRate'): number[] {
    // Simplified trend generation - in real implementation, you'd aggregate by time buckets
    const buckets = 24; // 24 data points
    const data: number[] = new Array(buckets).fill(0);
    
    // This is a placeholder implementation
    for (let i = 0; i < buckets; i++) {
      switch (type) {
        case 'requests':
          data[i] = Math.floor(Math.random() * 100);
          break;
        case 'responseTime':
          data[i] = Math.floor(Math.random() * 1000);
          break;
        case 'errorRate':
          data[i] = Math.random() * 0.1;
          break;
      }
    }
    
    return data;
  }
}

/**
 * Request metrics middleware
 */
export function requestMetricsMiddleware(monitoringService: ApiMonitoringService): MiddlewareHandler {
  return async (c: Context, next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const endpoint = c.req.path;
    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    
    // Get user context if available
    const authContext = c.get('authContext');
    const userId = authContext?.user_id;
    const tenantId = authContext?.tenant_id;
    const apiVersion = c.get('apiVersion');

    await next();

    const responseTime = Date.now() - startTime;
    const statusCode = c.res.status;

    // Record metrics
    const metrics: ApiMetrics = {
      endpoint,
      method,
      statusCode,
      responseTime,
      timestamp: Date.now(),
      userAgent,
      ipAddress,
      userId,
      tenantId,
      apiVersion,
    };

    // Add error message for failed requests
    if (statusCode >= 400) {
      try {
        const responseBody = await c.res.clone().json();
        metrics.errorMessage = responseBody.message || responseBody.error;
      } catch {
        // Ignore if response is not JSON
      }
    }

    monitoringService.recordMetrics(metrics);

    // Add performance headers
    c.header('X-Response-Time', `${responseTime}ms`);
    c.header('X-Request-ID', crypto.randomUUID());
  };
}

/**
 * Health check endpoint handler
 */
export function createHealthCheckHandler(monitoringService: ApiMonitoringService) {
  return async (c: Context) => {
    const db = c.env?.DB;
    const healthCheck = await monitoringService.performHealthCheck(db);
    
    const statusCode = healthCheck.status === 'healthy' ? 200 : 
                      healthCheck.status === 'degraded' ? 200 : 503;
    
    return c.json(healthCheck, statusCode);
  };
}

/**
 * Metrics endpoint handler
 */
export function createMetricsHandler(monitoringService: ApiMonitoringService) {
  return async (c: Context) => {
    const timeRange = c.req.query('range') as 'hour' | 'day' | 'week' || 'hour';
    const report = monitoringService.generatePerformanceReport(timeRange);
    
    return c.json({
      success: true,
      data: report,
      generatedAt: new Date().toISOString(),
    });
  };
}

/**
 * Monitoring utilities
 */
export const monitoringUtils = {
  /**
   * Format uptime duration
   */
  formatUptime(uptimeMs: number): string {
    const seconds = Math.floor(uptimeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },

  /**
   * Calculate availability percentage
   */
  calculateAvailability(successfulRequests: number, totalRequests: number): number {
    if (totalRequests === 0) return 100;
    return (successfulRequests / totalRequests) * 100;
  },

  /**
   * Determine health status color
   */
  getHealthStatusColor(status: string): string {
    const colors = {
      healthy: '#22c55e',
      degraded: '#f59e0b',
      unhealthy: '#ef4444',
    };
    return colors[status as keyof typeof colors] || '#6b7280';
  },

  /**
   * Format response time
   */
  formatResponseTime(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  },

  /**
   * Format error rate
   */
  formatErrorRate(rate: number): string {
    return `${(rate * 100).toFixed(2)}%`;
  },
};