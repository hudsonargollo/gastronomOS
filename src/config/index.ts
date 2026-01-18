/**
 * Configuration service for GastronomOS Authentication System
 * 
 * Manages environment-specific configuration and secrets for different deployment environments.
 * Provides type-safe access to configuration values with proper defaults.
 */

export interface AuthConfig {
  environment: 'development' | 'staging' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  jwt: {
    secret: string;
    expirySeconds: number;
    algorithm: string;
  };
  bcrypt: {
    rounds: number;
  };
  cache: {
    ttlSeconds: number;
    enabled: boolean;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowSeconds: number;
  };
  audit: {
    retentionDays: number;
    logSensitiveData: boolean;
  };
  database: {
    encryptionKey?: string;
  };
  admin: {
    apiKey?: string;
  };
}

export class ConfigService {
  private config: AuthConfig;

  constructor(env: any) {
    this.config = this.buildConfig(env);
    this.validateConfig();
  }

  private buildConfig(env: any): AuthConfig {
    const environment = env.ENVIRONMENT || 'development';
    
    return {
      environment: environment as AuthConfig['environment'],
      logLevel: (env.LOG_LEVEL || 'info') as AuthConfig['logLevel'],
      
      jwt: {
        secret: env.JWT_SECRET || this.getDefaultJWTSecret(environment),
        expirySeconds: parseInt(env.JWT_EXPIRY || '86400', 10), // 24 hours default
        algorithm: 'HS256',
      },
      
      bcrypt: {
        rounds: parseInt(env.BCRYPT_ROUNDS || '12', 10),
      },
      
      cache: {
        ttlSeconds: parseInt(env.CACHE_TTL || '300', 10), // 5 minutes default
        enabled: environment !== 'development', // Disable cache in dev for easier debugging
      },
      
      rateLimit: {
        enabled: env.RATE_LIMIT_ENABLED === 'true' || environment === 'production',
        maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        windowSeconds: parseInt(env.RATE_LIMIT_WINDOW_SECONDS || '60', 10),
      },
      
      audit: {
        retentionDays: parseInt(env.AUDIT_LOG_RETENTION_DAYS || '30', 10),
        logSensitiveData: environment === 'development', // Only log sensitive data in dev
      },
      
      database: {
        encryptionKey: env.DATABASE_ENCRYPTION_KEY,
      },
      
      admin: {
        apiKey: env.ADMIN_API_KEY,
      },
    };
  }

  private getDefaultJWTSecret(environment: string): string {
    // In production, JWT_SECRET must be provided as a secret
    if (environment === 'production') {
      throw new Error('JWT_SECRET is required in production environment');
    }
    
    // For development/staging, provide a default (not secure for production)
    return 'dev-jwt-secret-not-for-production-use-minimum-64-chars-required-for-security';
  }

  private validateConfig(): void {
    const errors: string[] = [];

    // Validate JWT secret length
    if (this.config.jwt.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long');
    }

    if (this.config.environment === 'production' && this.config.jwt.secret.length < 64) {
      errors.push('JWT secret must be at least 64 characters long in production');
    }

    // Validate bcrypt rounds
    if (this.config.bcrypt.rounds < 10 || this.config.bcrypt.rounds > 20) {
      errors.push('Bcrypt rounds must be between 10 and 20');
    }

    // Validate JWT expiry
    if (this.config.jwt.expirySeconds < 300) { // 5 minutes minimum
      errors.push('JWT expiry must be at least 5 minutes (300 seconds)');
    }

    if (this.config.jwt.expirySeconds > 86400 * 7) { // 7 days maximum
      errors.push('JWT expiry must not exceed 7 days for security');
    }

    // Production-specific validations
    if (this.config.environment === 'production') {
      if (!this.config.admin.apiKey) {
        console.warn('⚠️  ADMIN_API_KEY not set in production - admin endpoints will be disabled');
      }

      if (this.config.jwt.expirySeconds > 28800) { // 8 hours
        console.warn('⚠️  JWT expiry is longer than 8 hours in production - consider shorter expiry for security');
      }

      if (this.config.bcrypt.rounds < 12) {
        errors.push('Bcrypt rounds should be at least 12 in production for security');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  // Getter methods for type-safe access
  get environment(): AuthConfig['environment'] {
    return this.config.environment;
  }

  get logLevel(): AuthConfig['logLevel'] {
    return this.config.logLevel;
  }

  get jwt(): AuthConfig['jwt'] {
    return this.config.jwt;
  }

  get bcrypt(): AuthConfig['bcrypt'] {
    return this.config.bcrypt;
  }

  get cache(): AuthConfig['cache'] {
    return this.config.cache;
  }

  get rateLimit(): AuthConfig['rateLimit'] {
    return this.config.rateLimit;
  }

  get audit(): AuthConfig['audit'] {
    return this.config.audit;
  }

  get database(): AuthConfig['database'] {
    return this.config.database;
  }

  get admin(): AuthConfig['admin'] {
    return this.config.admin;
  }

  // Utility methods
  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  isStaging(): boolean {
    return this.config.environment === 'staging';
  }

  shouldLogDebug(): boolean {
    return ['debug'].includes(this.config.logLevel);
  }

  shouldLogInfo(): boolean {
    return ['debug', 'info'].includes(this.config.logLevel);
  }

  shouldLogWarn(): boolean {
    return ['debug', 'info', 'warn'].includes(this.config.logLevel);
  }

  // Get full configuration (for debugging - be careful with secrets)
  getConfig(): Readonly<AuthConfig> {
    return Object.freeze({ ...this.config });
  }

  // Get safe configuration (without secrets) for logging
  getSafeConfig(): Partial<AuthConfig> {
    const safeConfig = { ...this.config };
    
    // Remove sensitive information
    safeConfig.jwt = {
      ...safeConfig.jwt,
      secret: '[REDACTED]',
    };
    
    if (safeConfig.database.encryptionKey) {
      safeConfig.database.encryptionKey = '[REDACTED]';
    }
    
    if (safeConfig.admin.apiKey) {
      safeConfig.admin.apiKey = '[REDACTED]';
    }
    
    return safeConfig;
  }
}

// Factory function to create ConfigService instance
export function createConfig(env: any): ConfigService {
  return new ConfigService(env);
}

// Legacy constants for backward compatibility
export const CONFIG = {
  // JWT Configuration
  JWT: {
    ALGORITHM: 'HS256' as const,
    EXPIRES_IN: 24 * 60 * 60, // 24 hours in seconds
    ISSUER: 'gastronomos-auth',
    // Minimum secret length for security
    MIN_SECRET_LENGTH: 32,
  },

  // Password Security
  PASSWORD: {
    MIN_LENGTH: 8,
    DEFAULT_BCRYPT_ROUNDS: 12,
  },

  // Database Configuration
  DATABASE: {
    CONNECTION_TIMEOUT: 30000, // 30 seconds
    QUERY_TIMEOUT: 10000,      // 10 seconds
  },

  // Rate Limiting (for future implementation)
  RATE_LIMIT: {
    LOGIN_ATTEMPTS: 5,
    LOGIN_WINDOW: 15 * 60, // 15 minutes
  },

  // Audit Logging
  AUDIT: {
    RETENTION_DAYS: 90,
    MAX_ENTRIES_PER_QUERY: 1000,
  },

  // API Configuration
  API: {
    VERSION: 'v1',
    MAX_REQUEST_SIZE: 1024 * 1024, // 1MB
  },
} as const;

// Environment-specific configuration (legacy)
export function getEnvironmentConfig(env: string) {
  switch (env) {
    case 'production':
      return {
        LOG_LEVEL: 'error',
        DEBUG: false,
        CORS_ORIGINS: ['https://app.gastronomos.com'],
        JWT: {
          EXPIRES_IN: 24 * 60 * 60, // 24 hours
          REQUIRE_HTTPS: true,
        },
      };
    case 'staging':
      return {
        LOG_LEVEL: 'warn',
        DEBUG: false,
        CORS_ORIGINS: ['https://staging.gastronomos.com'],
        JWT: {
          EXPIRES_IN: 12 * 60 * 60, // 12 hours
          REQUIRE_HTTPS: true,
        },
      };
    default: // development
      return {
        LOG_LEVEL: 'debug',
        DEBUG: true,
        CORS_ORIGINS: ['http://localhost:3000', 'http://localhost:5173'],
        JWT: {
          EXPIRES_IN: 8 * 60 * 60, // 8 hours for development
          REQUIRE_HTTPS: false,
        },
      };
  }
}

// Configuration validation (legacy)
export function validateJWTConfig(secret: string, environment?: string): void {
  if (!secret) {
    throw new Error('JWT_SECRET is required but not provided');
  }

  if (secret.length < CONFIG.JWT.MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${CONFIG.JWT.MIN_SECRET_LENGTH} characters long`);
  }

  // In production, enforce stronger secret requirements
  if (environment === 'production') {
    if (secret.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters long in production');
    }
    
    // Check for basic entropy (not just repeated characters)
    const uniqueChars = new Set(secret).size;
    if (uniqueChars < 16) {
      throw new Error('JWT_SECRET must contain more diverse characters in production');
    }
  }
}

// Helper to get JWT expiration time based on environment (legacy)
export function getJWTExpirationTime(environment?: string): number {
  const envConfig = getEnvironmentConfig(environment || 'development');
  return envConfig.JWT?.EXPIRES_IN || CONFIG.JWT.EXPIRES_IN;
}