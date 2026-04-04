/**
 * Service Discovery and Health Check System
 * Provides service registration, discovery, and health monitoring
 * 
 * Requirements: All system integration requirements
 * - Implement service discovery and health checks
 * - Monitor service dependencies
 * - Provide aggregated health status
 */

import { ServiceContainer, ServiceIdentifier, ServiceHealth } from './service-container';

// Service metadata for discovery
export interface ServiceMetadata {
  identifier: ServiceIdentifier;
  name: string;
  description: string;
  version: string;
  dependencies: ServiceIdentifier[];
  tags: string[];
  endpoint?: string;
  healthCheckInterval: number; // milliseconds
  lastHealthCheck?: number;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy';
}

// Aggregated system health
export interface SystemHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'initializing';
  timestamp: number;
  services: Map<ServiceIdentifier, ServiceHealth>;
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    uninitialized: number;
  };
  dependencies: {
    service: ServiceIdentifier;
    dependsOn: ServiceIdentifier[];
    status: 'satisfied' | 'unsatisfied' | 'partial';
  }[];
  uptime: number;
  version: string;
  environment: string;
}

// Health check configuration
export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  retryDelay: number; // milliseconds
}

const DEFAULT_HEALTH_CHECK_CONFIG: HealthCheckConfig = {
  interval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
};

/**
 * Service Discovery
 * Manages service registration, discovery, and health monitoring
 */
export class ServiceDiscovery {
  private services: Map<ServiceIdentifier, ServiceMetadata> = new Map();
  private container: ServiceContainer;
  private healthCheckTimers: Map<ServiceIdentifier, ReturnType<typeof setInterval>> = new Map();
  private startTime: number;
  private config: HealthCheckConfig;

  constructor(container: ServiceContainer, config: Partial<HealthCheckConfig> = {}) {
    this.container = container;
    this.config = { ...DEFAULT_HEALTH_CHECK_CONFIG, ...config };
    this.startTime = Date.now();
    this.initializeServiceMetadata();
  }

  /**
   * Initialize service metadata for all registered services
   */
  private initializeServiceMetadata(): void {
    const serviceDescriptions: Record<ServiceIdentifier, { name: string; description: string; tags: string[] }> = {
      orderStateEngine: {
        name: 'Order State Engine',
        description: 'Manages order state transitions with validation and audit logging',
        tags: ['core', 'orders', 'state-machine'],
      },
      recipeEngine: {
        name: 'Recipe Engine',
        description: 'Calculates ingredient requirements and manages inventory consumption',
        tags: ['core', 'inventory', 'recipes'],
      },
      commissionEngine: {
        name: 'Commission Engine',
        description: 'Calculates and tracks waiter commissions',
        tags: ['core', 'commissions', 'reporting'],
      },
      paymentGatewayService: {
        name: 'Payment Gateway Service',
        description: 'Integrates with Mercado Pago for payment processing',
        tags: ['core', 'payments', 'external'],
      },
      auditLogger: {
        name: 'Audit Logger',
        description: 'Comprehensive audit logging for all system operations',
        tags: ['core', 'audit', 'compliance'],
      },
      webSocketService: {
        name: 'WebSocket Service',
        description: 'Real-time communication for multi-interface updates',
        tags: ['core', 'realtime', 'websocket'],
      },
      inventoryService: {
        name: 'Inventory Service',
        description: 'Integration with existing inventory system',
        tags: ['core', 'inventory', 'integration'],
      },
      stockAlertService: {
        name: 'Stock Alert Service',
        description: 'Monitors stock levels and generates alerts',
        tags: ['core', 'inventory', 'alerts'],
      },
      splitPaymentManager: {
        name: 'Split Payment Manager',
        description: 'Handles multiple partial payments for orders',
        tags: ['payments', 'split-payment'],
      },
      manualPaymentLogger: {
        name: 'Manual Payment Logger',
        description: 'Logs payments from external card machines',
        tags: ['payments', 'manual'],
      },
      pixGenerator: {
        name: 'Pix Generator',
        description: 'Generates Pix QR codes for payments',
        tags: ['payments', 'pix'],
      },
      healthMonitoringService: {
        name: 'Health Monitoring Service',
        description: 'System health monitoring and alerting',
        tags: ['monitoring', 'health'],
      },
      cacheService: {
        name: 'Cache Service',
        description: 'In-memory and Redis caching',
        tags: ['infrastructure', 'caching'],
      },
      monitoringService: {
        name: 'API Monitoring Service',
        description: 'API request metrics and monitoring',
        tags: ['monitoring', 'metrics'],
      },
      comprehensiveAuditService: {
        name: 'Comprehensive Audit Service',
        description: 'Advanced audit logging and reporting',
        tags: ['audit', 'compliance', 'reporting'],
      },
      webhookService: {
        name: 'Webhook System',
        description: 'Webhook management and delivery',
        tags: ['infrastructure', 'webhooks'],
      },
      scheduledJobsService: {
        name: 'Scheduled Jobs Service',
        description: 'Background job scheduling',
        tags: ['infrastructure', 'jobs'],
      },
      jwtService: {
        name: 'JWT Service',
        description: 'JWT token generation and validation',
        tags: ['auth', 'security'],
      },
      tenantConfigService: {
        name: 'Tenant Config Service',
        description: 'Tenant-specific configuration management',
        tags: ['multi-tenant', 'config'],
      },
    };

    // Register all services with their metadata
    for (const [identifier, meta] of Object.entries(serviceDescriptions)) {
      this.registerService(identifier as ServiceIdentifier, {
        identifier: identifier as ServiceIdentifier,
        name: meta.name,
        description: meta.description,
        version: '1.0.0',
        dependencies: [], // Will be populated from container
        tags: meta.tags,
        healthCheckInterval: this.config.interval,
      });
    }
  }

  /**
   * Register a service with metadata
   */
  registerService(identifier: ServiceIdentifier, metadata: Partial<ServiceMetadata>): void {
    const existing = this.services.get(identifier);
    
    this.services.set(identifier, {
      identifier,
      name: metadata.name || identifier,
      description: metadata.description || '',
      version: metadata.version || '1.0.0',
      dependencies: metadata.dependencies || [],
      tags: metadata.tags || [],
      endpoint: metadata.endpoint,
      healthCheckInterval: metadata.healthCheckInterval || this.config.interval,
      lastHealthCheck: existing?.lastHealthCheck,
      healthStatus: existing?.healthStatus,
    });
  }

  /**
   * Discover a service by identifier
   */
  discover<T>(identifier: ServiceIdentifier): Promise<T> {
    return this.container.get<T>(identifier);
  }

  /**
   * Discover services by tag
   */
  async discoverByTag(tag: string): Promise<Map<ServiceIdentifier, any>> {
    const results = new Map<ServiceIdentifier, any>();
    
    for (const [identifier, metadata] of this.services) {
      if (metadata.tags.includes(tag)) {
        try {
          const service = await this.container.get(identifier);
          results.set(identifier, service);
        } catch (error) {
          console.error(`Failed to discover service '${identifier}':`, error);
        }
      }
    }
    
    return results;
  }

  /**
   * Get service metadata
   */
  getServiceMetadata(identifier: ServiceIdentifier): ServiceMetadata | undefined {
    return this.services.get(identifier);
  }

  /**
   * Get all registered services
   */
  getAllServices(): ServiceMetadata[] {
    return Array.from(this.services.values());
  }

  /**
   * Start health check monitoring
   */
  startHealthMonitoring(): void {
    // Clear any existing timers
    this.stopHealthMonitoring();

    // Start health check for each service
    for (const [identifier, metadata] of this.services) {
      const timer = setInterval(async () => {
        await this.performHealthCheck(identifier);
      }, metadata.healthCheckInterval);
      
      this.healthCheckTimers.set(identifier, timer);
    }

    // Perform initial health check
    this.performAllHealthChecks().catch(console.error);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthMonitoring(): void {
    for (const timer of this.healthCheckTimers.values()) {
      clearInterval(timer);
    }
    this.healthCheckTimers.clear();
  }

  /**
   * Perform health check for a specific service
   */
  private async performHealthCheck(identifier: ServiceIdentifier): Promise<ServiceHealth> {
    const startTime = Date.now();
    const metadata = this.services.get(identifier);
    
    if (!metadata) {
      return {
        name: identifier,
        status: 'unhealthy',
        error: 'Service not registered',
        lastCheck: Date.now(),
      };
    }

    try {
      // Get service instance
      const service = await this.container.get(identifier);
      
      // Check if service has a health check method
      if (service && typeof (service as any).isHealthy === 'function') {
        const isHealthy = await this.executeWithTimeout(
          (service as any).isHealthy.bind(service),
          this.config.timeout
        );
        
        metadata.healthStatus = isHealthy ? 'healthy' : 'unhealthy';
        metadata.lastHealthCheck = Date.now();
        
        return {
          name: identifier,
          status: metadata.healthStatus,
          latency: Date.now() - startTime,
          lastCheck: metadata.lastHealthCheck,
          dependencies: metadata.dependencies,
        };
      }
      
      // Service is healthy if it can be retrieved
      metadata.healthStatus = 'healthy';
      metadata.lastHealthCheck = Date.now();
      
      return {
        name: identifier,
        status: 'healthy',
        latency: Date.now() - startTime,
        lastCheck: metadata.lastHealthCheck,
        dependencies: metadata.dependencies,
      };
      
    } catch (error) {
      metadata.healthStatus = 'unhealthy';
      metadata.lastHealthCheck = Date.now();
      
      return {
        name: identifier,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
        lastCheck: metadata.lastHealthCheck,
        dependencies: metadata.dependencies,
      };
    }
  }

  /**
   * Perform health checks for all services
   */
  async performAllHealthChecks(): Promise<Map<ServiceIdentifier, ServiceHealth>> {
    const results = new Map<ServiceIdentifier, ServiceHealth>();
    const promises: Promise<void>[] = [];

    for (const identifier of this.services.keys()) {
      promises.push(
        this.performHealthCheck(identifier).then(health => {
          results.set(identifier, health);
        })
      );
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Get comprehensive system health report
   */
  async getSystemHealthReport(): Promise<SystemHealthReport> {
    const serviceHealth = await this.container.checkHealth();
    
    // Calculate summary
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    let uninitialized = 0;

    for (const [, health] of serviceHealth) {
      switch (health.status) {
        case 'healthy': healthy++; break;
        case 'degraded': degraded++; break;
        case 'unhealthy': unhealthy++; break;
      }
    }

    // Check for uninitialized services
    for (const identifier of this.services.keys()) {
      if (!serviceHealth.has(identifier)) {
        uninitialized++;
      }
    }

    // Determine overall status
    let status: SystemHealthReport['status'];
    if (uninitialized > 0) {
      status = 'initializing';
    } else if (unhealthy > 0) {
      status = 'unhealthy';
    } else if (degraded > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    // Build dependency status
    const dependencies = this.buildDependencyStatus(serviceHealth);

    return {
      status,
      timestamp: Date.now(),
      services: serviceHealth,
      summary: {
        total: this.services.size,
        healthy,
        degraded,
        unhealthy,
        uninitialized,
      },
      dependencies,
      uptime: Date.now() - this.startTime,
      version: '1.0.0',
      environment: this.container.getEnv().ENVIRONMENT || 'development',
    };
  }

  /**
   * Build dependency status for each service
   */
  private buildDependencyStatus(
    serviceHealth: Map<ServiceIdentifier, ServiceHealth>
  ): SystemHealthReport['dependencies'] {
    const result: SystemHealthReport['dependencies'] = [];

    for (const [identifier, metadata] of this.services) {
      if (metadata.dependencies.length === 0) continue;

      const depStatuses = metadata.dependencies.map(dep => {
        const health = serviceHealth.get(dep);
        return health?.status === 'healthy';
      });

      const allSatisfied = depStatuses.every(Boolean);
      const someSatisfied = depStatuses.some(Boolean);

      result.push({
        service: identifier,
        dependsOn: metadata.dependencies,
        status: allSatisfied ? 'satisfied' : someSatisfied ? 'partial' : 'unsatisfied',
      });
    }

    return result;
  }

  /**
   * Check if a specific service is healthy
   */
  async isServiceHealthy(identifier: ServiceIdentifier): Promise<boolean> {
    const health = await this.performHealthCheck(identifier);
    return health.status === 'healthy';
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(identifier: ServiceIdentifier): ServiceIdentifier[] {
    const metadata = this.services.get(identifier);
    return metadata?.dependencies || [];
  }

  /**
   * Get services that depend on a given service
   */
  getDependentServices(identifier: ServiceIdentifier): ServiceIdentifier[] {
    const dependents: ServiceIdentifier[] = [];
    
    for (const [serviceId, metadata] of this.services) {
      if (metadata.dependencies.includes(identifier)) {
        dependents.push(serviceId);
      }
    }
    
    return dependents;
  }
}

// Factory function
export function createServiceDiscovery(
  container: ServiceContainer,
  config?: Partial<HealthCheckConfig>
): ServiceDiscovery {
  return new ServiceDiscovery(container, config);
}