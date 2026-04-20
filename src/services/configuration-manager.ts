/**
 * Configuration Management System
 * Manages environment variables and tenant-specific configurations
 * 
 * Requirements: All system integration requirements
 * - Add configuration management and environment variables
 * - Support tenant-specific configuration
 * - Provide secure credential storage
 */

import { ServiceContainer } from './service-container';

// Configuration schema
export interface SystemConfig {
  // Environment
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  // Database
  database: {
    connectionTimeout: number;
    queryTimeout: number;
    poolSize: number;
    enableWal: boolean;
  };
  
  // JWT
  jwt: {
    secret: string;
    expirySeconds: number;
    algorithm: 'HS256' | 'HS384' | 'HS512';
    issuer: string;
  };
  
  // Rate limiting
  rateLimit: {
    enabled: boolean;
    authMaxRequests: number;
    authWindowSeconds: number;
    apiMaxRequests: number;
    apiWindowSeconds: number;
  };
  
  // Cache
  cache: {
    enabled: boolean;
    defaultTTL: number;
    maxSize: number;
    maxMemory: number;
  };
  
  // Payment gateway
  payment: {
    encryptionKey: string;
    mercadoPagoBaseUrl: string;
    pixExpirationMinutes: number;
    webhookTimeout: number;
  };
  
  // WebSocket
  websocket: {
    enabled: boolean;
    heartbeatInterval: number;
    connectionTimeout: number;
    maxConnections: number;
    messageQueueSize: number;
  };
  
  // Audit
  audit: {
    enabled: boolean;
    retentionDays: number;
    logSensitiveData: boolean;
    maxEntriesPerQuery: number;
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    healthCheckInterval: number;
    metricsRetentionDays: number;
    alertThresholds: {
      responseTime: number;
      errorRate: number;
      memoryUsage: number;
    };
  };
  
  // Inventory
  inventory: {
    lockExpirationMinutes: number;
    stockCheckBatchSize: number;
    alertThresholds: {
      lowStock: number;
      criticalStock: number;
    };
  };
  
  // Commission
  commission: {
    defaultType: 'PERCENTAGE' | 'FIXED_VALUE';
    defaultRate: number;
    calculationBatchSize: number;
  };
}

// Configuration source priority
type ConfigSource = 'env' | 'database' | 'default' | 'override';

// Configuration value with source tracking
interface ConfigValue<T> {
  value: T;
  source: ConfigSource;
  lastUpdated: number;
}

/**
 * Configuration Manager
 * Manages system-wide and tenant-specific configurations
 */
export class ConfigurationManager {
  private config: Map<string, ConfigValue<any>> = new Map();
  private env: Record<string, any>;
  private container: ServiceContainer;
  private tenantConfigs: Map<string, Map<string, any>> = new Map();

  constructor(container: ServiceContainer) {
    this.container = container;
    this.env = container.getEnv() as any;
    this.initializeDefaults();
    this.loadFromEnvironment();
  }

  /**
   * Initialize default configuration values
   */
  private initializeDefaults(): void {
    // Environment defaults
    this.set('environment', 'development', 'default');
    this.set('logLevel', 'info', 'default');
    
    // Database defaults
    this.set('database.connectionTimeout', 30000, 'default');
    this.set('database.queryTimeout', 10000, 'default');
    this.set('database.poolSize', 10, 'default');
    this.set('database.enableWal', true, 'default');
    
    // JWT defaults
    this.set('jwt.algorithm', 'HS256', 'default');
    this.set('jwt.issuer', 'pontal-stock', 'default');
    this.set('jwt.expirySeconds', 86400, 'default'); // 24 hours
    
    // Rate limiting defaults
    this.set('rateLimit.enabled', true, 'default');
    this.set('rateLimit.authMaxRequests', 5, 'default');
    this.set('rateLimit.authWindowSeconds', 900, 'default'); // 15 minutes
    this.set('rateLimit.apiMaxRequests', 100, 'default');
    this.set('rateLimit.apiWindowSeconds', 60, 'default');
    
    // Cache defaults
    this.set('cache.enabled', true, 'default');
    this.set('cache.defaultTTL', 300, 'default'); // 5 minutes
    this.set('cache.maxSize', 10000, 'default');
    this.set('cache.maxMemory', 100 * 1024 * 1024, 'default'); // 100MB
    
    // Payment defaults
    this.set('payment.mercadoPagoBaseUrl', 'https://api.mercadopago.com', 'default');
    this.set('payment.pixExpirationMinutes', 15, 'default');
    this.set('payment.webhookTimeout', 30000, 'default');
    
    // WebSocket defaults
    this.set('websocket.enabled', true, 'default');
    this.set('websocket.heartbeatInterval', 30000, 'default');
    this.set('websocket.connectionTimeout', 60000, 'default');
    this.set('websocket.maxConnections', 1000, 'default');
    this.set('websocket.messageQueueSize', 100, 'default');
    
    // Audit defaults
    this.set('audit.enabled', true, 'default');
    this.set('audit.retentionDays', 90, 'default');
    this.set('audit.logSensitiveData', false, 'default');
    this.set('audit.maxEntriesPerQuery', 1000, 'default');
    
    // Monitoring defaults
    this.set('monitoring.enabled', true, 'default');
    this.set('monitoring.healthCheckInterval', 30000, 'default');
    this.set('monitoring.metricsRetentionDays', 30, 'default');
    this.set('monitoring.alertThresholds.responseTime', 5000, 'default');
    this.set('monitoring.alertThresholds.errorRate', 0.05, 'default');
    this.set('monitoring.alertThresholds.memoryUsage', 0.9, 'default');
    
    // Inventory defaults
    this.set('inventory.lockExpirationMinutes', 60, 'default');
    this.set('inventory.stockCheckBatchSize', 100, 'default');
    this.set('inventory.alertThresholds.lowStock', 10, 'default');
    this.set('inventory.alertThresholds.criticalStock', 5, 'default');
    
    // Commission defaults
    this.set('commission.defaultType', 'PERCENTAGE', 'default');
    this.set('commission.defaultRate', 10, 'default');
    this.set('commission.calculationBatchSize', 100, 'default');
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Environment
    if (this.env.ENVIRONMENT) {
      this.set('environment', this.env.ENVIRONMENT, 'env');
    }
    if (this.env.LOG_LEVEL) {
      this.set('logLevel', this.env.LOG_LEVEL, 'env');
    }
    
    // JWT
    if (this.env.JWT_SECRET) {
      this.set('jwt.secret', this.env.JWT_SECRET, 'env');
    }
    if (this.env.JWT_EXPIRY) {
      this.set('jwt.expirySeconds', parseInt(this.env.JWT_EXPIRY, 10), 'env');
    }
    
    // Bcrypt
    if (this.env.BCRYPT_ROUNDS) {
      this.set('bcrypt.rounds', parseInt(this.env.BCRYPT_ROUNDS, 10), 'env');
    }
    
    // Payment
    if (this.env.PAYMENT_ENCRYPTION_KEY) {
      this.set('payment.encryptionKey', this.env.PAYMENT_ENCRYPTION_KEY, 'env');
    }
    if (this.env.MERCADO_PAGO_ACCESS_TOKEN) {
      this.set('payment.mercadoPagoAccessToken', this.env.MERCADO_PAGO_ACCESS_TOKEN, 'env');
    }
    if (this.env.MERCADO_PAGO_PUBLIC_KEY) {
      this.set('payment.mercadoPagoPublicKey', this.env.MERCADO_PAGO_PUBLIC_KEY, 'env');
    }
    
    // Cache
    if (this.env.REDIS_URL) {
      this.set('cache.redisUrl', this.env.REDIS_URL, 'env');
    }
    if (this.env.CACHE_TTL) {
      this.set('cache.defaultTTL', parseInt(this.env.CACHE_TTL, 10), 'env');
    }
    
    // Rate limiting
    if (this.env.RATE_LIMIT_ENABLED) {
      this.set('rateLimit.enabled', this.env.RATE_LIMIT_ENABLED === 'true', 'env');
    }
    if (this.env.RATE_LIMIT_MAX_REQUESTS) {
      this.set('rateLimit.apiMaxRequests', parseInt(this.env.RATE_LIMIT_MAX_REQUESTS, 10), 'env');
    }
    
    // Audit
    if (this.env.AUDIT_LOG_RETENTION_DAYS) {
      this.set('audit.retentionDays', parseInt(this.env.AUDIT_LOG_RETENTION_DAYS, 10), 'env');
    }
    if (this.env.DATABASE_ENCRYPTION_KEY) {
      this.set('database.encryptionKey', this.env.DATABASE_ENCRYPTION_KEY, 'env');
    }
    
    // Admin
    if (this.env.ADMIN_API_KEY) {
      this.set('admin.apiKey', this.env.ADMIN_API_KEY, 'env');
    }
    
    // Webhook
    if (this.env.WEBHOOK_SECRET) {
      this.set('webhook.secret', this.env.WEBHOOK_SECRET, 'env');
    }
  }

  /**
   * Set a configuration value
   */
  set(key: string, value: any, source: ConfigSource = 'override'): void {
    this.config.set(key, {
      value,
      source,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Get a configuration value
   */
  get<T>(key: string, defaultValue?: T): T {
    const configValue = this.config.get(key);
    
    if (configValue !== undefined) {
      return configValue.value as T;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    throw new Error(`Configuration key '${key}' not found and no default provided`);
  }

  /**
   * Get a configuration value with source information
   */
  getWithSource(key: string): ConfigValue<any> | undefined {
    return this.config.get(key);
  }

  /**
   * Check if a configuration key exists
   */
  has(key: string): boolean {
    return this.config.has(key);
  }

  /**
   * Get all configuration keys
   */
  keys(): string[] {
    return Array.from(this.config.keys());
  }

  /**
   * Get configuration for a specific namespace
   */
  getNamespace<T extends Record<string, any>>(namespace: string): T {
    const result: Record<string, any> = {};
    const prefix = `${namespace}.`;
    
    for (const [key, configValue] of this.config) {
      if (key.startsWith(prefix)) {
        const subKey = key.slice(prefix.length);
        result[subKey] = configValue.value;
      }
    }
    
    return result as T;
  }

  /**
   * Get the complete system configuration
   */
  getSystemConfig(): SystemConfig {
    return {
      environment: this.get('environment'),
      logLevel: this.get('logLevel'),
      database: this.getNamespace('database'),
      jwt: this.getNamespace('jwt'),
      rateLimit: this.getNamespace('rateLimit'),
      cache: this.getNamespace('cache'),
      payment: this.getNamespace('payment'),
      websocket: this.getNamespace('websocket'),
      audit: this.getNamespace('audit'),
      monitoring: this.getNamespace('monitoring'),
      inventory: this.getNamespace('inventory'),
      commission: this.getNamespace('commission'),
    };
  }

  /**
   * Get tenant-specific configuration
   */
  async getTenantConfig(tenantId: string): Promise<Record<string, any>> {
    // Check cache first
    if (this.tenantConfigs.has(tenantId)) {
      return Object.fromEntries(this.tenantConfigs.get(tenantId)!);
    }
    
    // Load from database
    try {
      const tenantConfigService = await this.container.get('tenantConfigService');
      const config = await tenantConfigService.getTenantConfig(tenantId);
      
      // Cache the configuration
      this.tenantConfigs.set(tenantId, new Map(Object.entries(config)));
      
      return config;
    } catch (error) {
      console.error(`Failed to load tenant config for ${tenantId}:`, error);
      return {};
    }
  }

  /**
   * Get a specific tenant configuration value
   */
  async getTenantValue<T>(tenantId: string, key: string, defaultValue?: T): Promise<T> {
    const config = await this.getTenantConfig(tenantId);
    
    if (config[key] !== undefined) {
      return config[key] as T;
    }
    
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    
    throw new Error(`Tenant configuration key '${key}' not found for tenant ${tenantId}`);
  }

  /**
   * Invalidate tenant configuration cache
   */
  invalidateTenantCache(tenantId?: string): void {
    if (tenantId) {
      this.tenantConfigs.delete(tenantId);
    } else {
      this.tenantConfigs.clear();
    }
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate environment
    const environment = this.get('environment');
    if (!['development', 'staging', 'production'].includes(environment)) {
      errors.push(`Invalid environment: ${environment}`);
    }
    
    // Validate JWT secret
    const jwtSecret = this.get('jwt.secret', '');
    if (!jwtSecret) {
      errors.push('JWT secret is required');
    } else if (jwtSecret.length < 32) {
      errors.push('JWT secret must be at least 32 characters');
    }
    
    // Production-specific validations
    if (environment === 'production') {
      if (jwtSecret.length < 64) {
        errors.push('JWT secret must be at least 64 characters in production');
      }
      
      if (!this.get('payment.encryptionKey', '')) {
        errors.push('Payment encryption key is required in production');
      }
      
      if (this.get('audit.logSensitiveData')) {
        errors.push('Sensitive data logging should be disabled in production');
      }
    }
    
    // Validate numeric ranges
    const poolSize = this.get('database.poolSize');
    if (poolSize < 1 || poolSize > 100) {
      errors.push('Database pool size must be between 1 and 100');
    }
    
    const cacheTTL = this.get('cache.defaultTTL');
    if (cacheTTL < 0) {
      errors.push('Cache TTL cannot be negative');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get safe configuration for logging (without secrets)
   */
  getSafeConfig(): Record<string, any> {
    const safeConfig: Record<string, any> = {};
    const sensitiveKeys = [
      'jwt.secret',
      'payment.encryptionKey',
      'payment.mercadoPagoAccessToken',
      'payment.mercadoPagoPublicKey',
      'database.encryptionKey',
      'admin.apiKey',
      'webhook.secret',
    ];
    
    for (const [key, configValue] of this.config) {
      if (sensitiveKeys.includes(key)) {
        safeConfig[key] = '[REDACTED]';
      } else {
        safeConfig[key] = configValue.value;
      }
    }
    
    return safeConfig;
  }

  /**
   * Reload configuration from environment
   */
  reload(): void {
    this.loadFromEnvironment();
  }
}

// Factory function
export function createConfigurationManager(container: ServiceContainer): ConfigurationManager {
  return new ConfigurationManager(container);
}