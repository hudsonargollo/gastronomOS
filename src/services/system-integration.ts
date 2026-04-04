/**
 * System Integration Module
 * Wires all components together with dependency injection
 * 
 * Requirements: All system integration requirements
 * - Connect all services through dependency injection
 * - Implement service discovery and health checks
 * - Add configuration management and environment variables
 * - Create database connection pooling and optimization
 */

import { ServiceContainer, getServiceContainer, resetServiceContainer, EnvironmentConfig } from './service-container';
import { ServiceDiscovery, createServiceDiscovery } from './service-discovery';
import { ConfigurationManager, createConfigurationManager } from './configuration-manager';
import { DatabasePool, initializeDatabasePool, getDatabasePool, resetDatabasePool } from './database-pool';

// System integration status
export interface IntegrationStatus {
  initialized: boolean;
  healthy: boolean;
  services: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  database: {
    connected: boolean;
    latency?: number;
  };
  config: {
    valid: boolean;
    errors: string[];
  };
  uptime: number;
}

// System integrator
export class SystemIntegrator {
  private container: ServiceContainer | null = null;
  private discovery: ServiceDiscovery | null = null;
  private configManager: ConfigurationManager | null = null;
  private dbPool: DatabasePool | null = null;
  private startTime: number = 0;
  private isInitialized: boolean = false;

  /**
   * Initialize the entire system
   */
  async initialize(env: EnvironmentConfig): Promise<void> {
    if (this.isInitialized) {
      console.warn('System already initialized');
      return;
    }

    this.startTime = Date.now();
    console.log('[SystemIntegrator] Starting system initialization...');

    try {
      // Step 1: Initialize database pool
      console.log('[SystemIntegrator] Initializing database pool...');
      this.dbPool = await initializeDatabasePool(env.DB, {
        maxConnections: 10,
        queryTimeout: 30000,
        enableWal: true,
      });
      console.log('[SystemIntegrator] Database pool initialized');

      // Step 2: Create service container
      console.log('[SystemIntegrator] Creating service container...');
      this.container = getServiceContainer(env);
      
      // Step 3: Initialize configuration manager
      console.log('[SystemIntegrator] Initializing configuration manager...');
      this.configManager = createConfigurationManager(this.container);
      
      // Validate configuration
      const configValidation = this.configManager.validate();
      if (!configValidation.valid) {
        console.error('[SystemIntegrator] Configuration validation failed:', configValidation.errors);
        // Continue anyway - some errors might be acceptable in development
      }
      console.log('[SystemIntegrator] Configuration manager initialized');

      // Step 4: Initialize all services
      console.log('[SystemIntegrator] Initializing services...');
      await this.container.initializeAll();
      console.log('[SystemIntegrator] All services initialized');

      // Step 5: Create service discovery
      console.log('[SystemIntegrator] Creating service discovery...');
      this.discovery = createServiceDiscovery(this.container, {
        interval: 30000,
        timeout: 5000,
        retries: 3,
      });
      
      // Start health monitoring
      this.discovery.startHealthMonitoring();
      console.log('[SystemIntegrator] Service discovery started');

      this.isInitialized = true;
      console.log('[SystemIntegrator] System initialization complete');
      
    } catch (error) {
      console.error('[SystemIntegrator] Initialization failed:', error);
      await this.dispose();
      throw error;
    }
  }

  /**
   * Get the service container
   */
  getContainer(): ServiceContainer {
    if (!this.container) {
      throw new Error('System not initialized');
    }
    return this.container;
  }

  /**
   * Get the service discovery
   */
  getDiscovery(): ServiceDiscovery {
    if (!this.discovery) {
      throw new Error('System not initialized');
    }
    return this.discovery;
  }

  /**
   * Get the configuration manager
   */
  getConfigManager(): ConfigurationManager {
    if (!this.configManager) {
      throw new Error('System not initialized');
    }
    return this.configManager;
  }

  /**
   * Get the database pool
   */
  getDbPool(): DatabasePool {
    if (!this.dbPool) {
      throw new Error('System not initialized');
    }
    return this.dbPool;
  }

  /**
   * Get a service by identifier
   */
  async getService<T>(identifier: string): Promise<T> {
    return this.getContainer().get<T>(identifier as any);
  }

  /**
   * Get system configuration
   */
  getConfig<T>(key: string, defaultValue?: T): T {
    return this.getConfigManager().get<T>(key, defaultValue);
  }

  /**
   * Get tenant configuration
   */
  async getTenantConfig(tenantId: string): Promise<Record<string, any>> {
    return this.getConfigManager().getTenantConfig(tenantId);
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<IntegrationStatus> {
    const status: IntegrationStatus = {
      initialized: this.isInitialized,
      healthy: false,
      services: { total: 0, healthy: 0, unhealthy: 0 },
      database: { connected: false },
      config: { valid: false, errors: [] },
      uptime: this.isInitialized ? Date.now() - this.startTime : 0,
    };

    if (!this.isInitialized) {
      return status;
    }

    try {
      // Check services health
      const healthReport = await this.discovery!.getSystemHealthReport();
      status.services = {
        total: healthReport.summary.total,
        healthy: healthReport.summary.healthy,
        unhealthy: healthReport.summary.unhealthy + healthReport.summary.uninitialized,
      };

      // Check database health
      const dbHealth = await this.dbPool!.checkHealth();
      status.database = {
        connected: dbHealth.healthy,
        latency: dbHealth.latency,
      };

      // Check configuration
      const configValidation = this.configManager!.validate();
      status.config = {
        valid: configValidation.valid,
        errors: configValidation.errors,
      };

      // Overall health
      status.healthy = 
        status.services.unhealthy === 0 &&
        status.database.connected &&
        (status.config.valid || this.getConfig('environment') === 'development');

    } catch (error) {
      console.error('[SystemIntegrator] Health check failed:', error);
    }

    return status;
  }

  /**
   * Get detailed health report
   */
  async getDetailedHealthReport(): Promise<{
    status: IntegrationStatus;
    services: Map<string, any>;
    database: any;
    config: any;
  }> {
    const status = await this.checkHealth();
    
    let servicesHealth: Map<string, any> = new Map();
    let databaseStats: any = {};
    let configSnapshot: any = {};

    if (this.isInitialized) {
      // Get services health
      servicesHealth = await this.discovery!.performAllHealthChecks();
      
      // Get database stats
      databaseStats = {
        pool: this.dbPool!.getStats(),
        size: await this.dbPool!.getDatabaseSize(),
        tables: await this.dbPool!.getTableStats(),
      };
      
      // Get safe config snapshot
      configSnapshot = this.configManager!.getSafeConfig();
    }

    return {
      status,
      services: servicesHealth,
      database: databaseStats,
      config: configSnapshot,
    };
  }

  /**
   * Dispose of all resources
   */
  async dispose(): Promise<void> {
    console.log('[SystemIntegrator] Disposing system...');

    if (this.discovery) {
      this.discovery.stopHealthMonitoring();
      this.discovery = null;
    }

    if (this.container) {
      await this.container.dispose();
      resetServiceContainer();
      this.container = null;
    }

    if (this.dbPool) {
      await this.dbPool.dispose();
      resetDatabasePool();
      this.dbPool = null;
    }

    this.configManager = null;
    this.isInitialized = false;
    
    console.log('[SystemIntegrator] System disposed');
  }
}

// Singleton instance
let integratorInstance: SystemIntegrator | null = null;

/**
 * Get or create the system integrator singleton
 */
export function getSystemIntegrator(): SystemIntegrator {
  if (!integratorInstance) {
    integratorInstance = new SystemIntegrator();
  }
  return integratorInstance;
}

/**
 * Initialize the system
 */
export async function initializeSystem(env: EnvironmentConfig): Promise<SystemIntegrator> {
  const integrator = getSystemIntegrator();
  await integrator.initialize(env);
  return integrator;
}

/**
 * Reset the system (useful for testing)
 */
export async function resetSystem(): Promise<void> {
  if (integratorInstance) {
    await integratorInstance.dispose();
    integratorInstance = null;
  }
}

// Re-export types and utilities
export { ServiceContainer, ServiceIdentifier, ServiceHealth } from './service-container';
export { ServiceDiscovery, ServiceMetadata, SystemHealthReport } from './service-discovery';
export { ConfigurationManager, SystemConfig } from './configuration-manager';
export { DatabasePool, PoolConfig, ConnectionStats, QueryMetrics } from './database-pool';