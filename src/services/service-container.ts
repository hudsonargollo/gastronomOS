/**
 * Dependency Injection Container
 * Wires all services together with proper lifecycle management
 * 
 * Requirements: All system integration requirements
 * - Connect all services through dependency injection
 * - Implement service discovery and health checks
 * - Add configuration management and environment variables
 * - Create database connection pooling and optimization
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

// Import all services
import { OrderStateEngine } from './order-state-engine';
import { RecipeEngine, createRecipeEngine } from './recipe-engine';
import { CommissionEngine, createCommissionEngine } from './commission-engine';
import { PaymentGatewayService } from './payment-gateway';
import { AuditLogger, createAuditLogger } from './audit-logger';
import { WebSocketService } from './websocket-service';
import { InventoryIntegrationService, createInventoryIntegrationService } from './inventory-integration';
import { StockAlertService, createStockAlertService } from './stock-alert';
import { SplitPaymentManager } from './split-payment-manager';
import { ManualPaymentLogger } from './manual-payment-logger';
import { PixGenerator } from './pix-generator';
import { SystemHealthMonitoringService } from './system-health-monitoring';
import { CacheService } from './caching';
import { ApiMonitoringService } from './api-monitoring';
import { ComprehensiveAuditService } from './comprehensive-audit';
import { WebhookSystemService } from './webhook-system';
import { ScheduledJobsService } from './scheduled-jobs';
import { createJWTService, IJWTService } from './jwt';
import { TenantConfigService } from './tenant-config';

// Service identifiers
export type ServiceIdentifier = 
  | 'orderStateEngine'
  | 'recipeEngine'
  | 'commissionEngine'
  | 'paymentGatewayService'
  | 'auditLogger'
  | 'webSocketService'
  | 'inventoryService'
  | 'stockAlertService'
  | 'splitPaymentManager'
  | 'manualPaymentLogger'
  | 'pixGenerator'
  | 'healthMonitoringService'
  | 'cacheService'
  | 'monitoringService'
  | 'comprehensiveAuditService'
  | 'webhookService'
  | 'scheduledJobsService'
  | 'jwtService'
  | 'tenantConfigService';

// Service health status
export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  lastCheck: number;
  dependencies?: string[];
}

// Service registry entry
interface ServiceRegistryEntry<T = any> {
  instance?: T;
  factory: (container: ServiceContainer) => T | Promise<T>;
  isSingleton: boolean;
  isInitialized: boolean;
  dependencies: ServiceIdentifier[];
  healthCheck?: (instance: T) => Promise<boolean>;
}

// Environment configuration
export interface EnvironmentConfig {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
  BCRYPT_ROUNDS?: string;
  RECEIPT_BUCKET?: R2Bucket;
  RECEIPT_QUEUE?: Queue;
  AI?: Ai;
  REDIS_URL?: string;
  WEBHOOK_SECRET?: string;
  WEBSOCKET_DO?: DurableObjectNamespace;
  PAYMENT_ENCRYPTION_KEY?: string;
  MERCADO_PAGO_ACCESS_TOKEN?: string;
  MERCADO_PAGO_PUBLIC_KEY?: string;
}

/**
 * Service Container
 * Manages dependency injection and service lifecycle
 */
export class ServiceContainer {
  private registry: Map<ServiceIdentifier, ServiceRegistryEntry> = new Map();
  private healthStatus: Map<ServiceIdentifier, ServiceHealth> = new Map();
  private env: EnvironmentConfig;
  private db: ReturnType<typeof drizzle>;
  private initializationPromise: Promise<void> | null = null;

  constructor(env: EnvironmentConfig) {
    this.env = env;
    this.db = drizzle(env.DB, { schema });
    this.registerServices();
  }

  /**
   * Register all services with their factories and dependencies
   */
  private registerServices(): void {
    // Core services
    this.register('jwtService', () => createJWTService(this.env.JWT_SECRET, this.env.ENVIRONMENT), true, [], this.checkJWTHealth);
    
    this.register('cacheService', () => new CacheService({
      memory: { maxSize: 10000, maxMemory: 100 * 1024 * 1024 },
      redis: this.env.REDIS_URL ? { url: this.env.REDIS_URL } : undefined,
    }), true, [], this.checkCacheHealth);

    this.register('monitoringService', () => new ApiMonitoringService(), true, []);

    this.register('comprehensiveAuditService', () => new ComprehensiveAuditService(this.env.DB), true, ['jwtService']);

    this.register('webhookService', () => new WebhookSystemService(), true, []);

    this.register('scheduledJobsService', () => new ScheduledJobsService(), true, []);

    // Database-dependent services
    this.register('auditLogger', () => createAuditLogger(this.db), true, []);

    this.register('inventoryService', () => createInventoryIntegrationService(this.db), true, []);

    this.register('stockAlertService', () => createStockAlertService(this.db), true, ['inventoryService']);

    this.register('recipeEngine', () => createRecipeEngine(this.db), true, ['inventoryService', 'stockAlertService']);

    this.register('orderStateEngine', () => new OrderStateEngine(this.db), true, ['recipeEngine', 'auditLogger']);

    this.register('commissionEngine', () => createCommissionEngine(this.db), true, ['auditLogger']);

    this.register('paymentGatewayService', () => new PaymentGatewayService(this.db, this.env.PAYMENT_ENCRYPTION_KEY), true, []);

    this.register('splitPaymentManager', () => new SplitPaymentManager(this.db), true, ['paymentGatewayService', 'auditLogger']);

    this.register('manualPaymentLogger', () => new ManualPaymentLogger(this.db), true, ['auditLogger']);

    this.register('pixGenerator', () => new PixGenerator(), true, ['paymentGatewayService']);

    this.register('tenantConfigService', () => new TenantConfigService(this.db), true, []);

    // WebSocket service (requires Durable Object namespace)
    this.register('webSocketService', () => {
      if (!this.env.WEBSOCKET_DO) {
        console.warn('WebSocket Durable Object not configured - real-time features disabled');
        return null as any;
      }
      return new WebSocketService(this.env.WEBSOCKET_DO);
    }, true, []);

    // Health monitoring service
    this.register('healthMonitoringService', () => new SystemHealthMonitoringService(this.db), true, [
      'orderStateEngine',
      'recipeEngine',
      'commissionEngine',
      'paymentGatewayService',
      'auditLogger',
      'webSocketService',
    ]);
  }

  /**
   * Register a service with its factory and dependencies
   */
  register<T>(
    identifier: ServiceIdentifier,
    factory: (container: ServiceContainer) => T | Promise<T>,
    isSingleton: boolean = true,
    dependencies: ServiceIdentifier[] = [],
    healthCheck?: (instance: T) => Promise<boolean>
  ): void {
    this.registry.set(identifier, {
      factory,
      isSingleton,
      isInitialized: false,
      dependencies,
      healthCheck,
    });
  }

  /**
   * Get a service instance
   */
  async get<T>(identifier: ServiceIdentifier): Promise<T> {
    const entry = this.registry.get(identifier);
    if (!entry) {
      throw new Error(`Service '${identifier}' not registered`);
    }

    // Return cached instance for singletons
    if (entry.isSingleton && entry.instance) {
      return entry.instance;
    }

    // Initialize dependencies first
    for (const dep of entry.dependencies) {
      await this.get(dep);
    }

    // Create instance
    const instance = await entry.factory(this);
    
    if (entry.isSingleton) {
      entry.instance = instance;
      entry.isInitialized = true;
    }

    return instance;
  }

  /**
   * Get a service synchronously (only for already initialized singletons)
   */
  getSync<T>(identifier: ServiceIdentifier): T {
    const entry = this.registry.get(identifier);
    if (!entry) {
      throw new Error(`Service '${identifier}' not registered`);
    }

    if (!entry.isSingleton || !entry.isInitialized || !entry.instance) {
      throw new Error(`Service '${identifier}' not initialized. Use get() for async initialization.`);
    }

    return entry.instance;
  }

  /**
   * Initialize all services
   */
  async initializeAll(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitializeAll();
    return this.initializationPromise;
  }

  private async doInitializeAll(): Promise<void> {
    const initOrder = this.getInitializationOrder();
    
    for (const identifier of initOrder) {
      try {
        await this.get(identifier);
      } catch (error) {
        console.error(`Failed to initialize service '${identifier}':`, error);
        // Continue with other services
      }
    }
  }

  /**
   * Get initialization order based on dependencies
   */
  private getInitializationOrder(): ServiceIdentifier[] {
    const order: ServiceIdentifier[] = [];
    const visited = new Set<ServiceIdentifier>();
    const visiting = new Set<ServiceIdentifier>();

    const visit = (identifier: ServiceIdentifier) => {
      if (visited.has(identifier)) return;
      if (visiting.has(identifier)) {
        throw new Error(`Circular dependency detected involving '${identifier}'`);
      }

      visiting.add(identifier);
      const entry = this.registry.get(identifier);
      
      if (entry) {
        for (const dep of entry.dependencies) {
          visit(dep);
        }
      }

      visiting.delete(identifier);
      visited.add(identifier);
      order.push(identifier);
    };

    for (const identifier of this.registry.keys()) {
      visit(identifier);
    }

    return order;
  }

  /**
   * Check health of all services
   */
  async checkHealth(): Promise<Map<ServiceIdentifier, ServiceHealth>> {
    const healthPromises: Promise<void>[] = [];

    for (const [identifier, entry] of this.registry) {
      if (entry.isInitialized && entry.instance && entry.healthCheck) {
        healthPromises.push(this.checkServiceHealth(identifier, entry));
      } else if (entry.isInitialized && entry.instance) {
        // Service is healthy if initialized without health check
        this.healthStatus.set(identifier, {
          name: identifier,
          status: 'healthy',
          lastCheck: Date.now(),
          dependencies: entry.dependencies,
        });
      }
    }

    await Promise.all(healthPromises);
    return this.healthStatus;
  }

  private async checkServiceHealth(identifier: ServiceIdentifier, entry: ServiceRegistryEntry): Promise<void> {
    const startTime = Date.now();
    
    try {
      const isHealthy = entry.healthCheck ? await entry.healthCheck(entry.instance) : true;
      const latency = Date.now() - startTime;

      this.healthStatus.set(identifier, {
        name: identifier,
        status: isHealthy ? 'healthy' : 'unhealthy',
        latency,
        lastCheck: Date.now(),
        dependencies: entry.dependencies,
      });
    } catch (error) {
      this.healthStatus.set(identifier, {
        name: identifier,
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
        lastCheck: Date.now(),
        dependencies: entry.dependencies,
      });
    }
  }

  // Health check implementations
  private checkJWTHealth = async (jwtService: IJWTService): Promise<boolean> => {
    try {
      // Verify the service can sign and verify a test token
      const testPayload = { test: true, timestamp: Date.now() };
      const token = await jwtService.sign(testPayload);
      const decoded = await jwtService.verify(token);
      return decoded.test === true;
    } catch {
      return false;
    }
  };

  private checkCacheHealth = async (cacheService: CacheService): Promise<boolean> => {
    try {
      const testKey = `health-check-${Date.now()}`;
      await cacheService.set(testKey, { healthy: true }, 10);
      const result = await cacheService.get(testKey);
      return result?.healthy === true;
    } catch {
      return false;
    }
  };

  /**
   * Get database instance
   */
  getDatabase(): ReturnType<typeof drizzle> {
    return this.db;
  }

  /**
   * Get environment configuration
   */
  getEnv(): EnvironmentConfig {
    return this.env;
  }

  /**
   * Dispose all services
   */
  async dispose(): Promise<void> {
    for (const [identifier, entry] of this.registry) {
      if (entry.instance && typeof (entry.instance as any).dispose === 'function') {
        try {
          await (entry.instance as any).dispose();
        } catch (error) {
          console.error(`Error disposing service '${identifier}':`, error);
        }
      }
      entry.instance = undefined;
      entry.isInitialized = false;
    }
    this.healthStatus.clear();
    this.initializationPromise = null;
  }
}

// Singleton container instance
let containerInstance: ServiceContainer | null = null;

/**
 * Get or create the service container singleton
 */
export function getServiceContainer(env: EnvironmentConfig): ServiceContainer {
  if (!containerInstance) {
    containerInstance = new ServiceContainer(env);
  }
  return containerInstance;
}

/**
 * Reset the service container (useful for testing)
 */
export function resetServiceContainer(): void {
  if (containerInstance) {
    containerInstance.dispose().catch(console.error);
    containerInstance = null;
  }
}