// Export all schema definitions and types
export * from './schema';

// Export migration utilities
export { runMigrations, createDrizzleDb, checkMigrationStatus } from './migrate';

// Re-export Drizzle ORM utilities that will be commonly used
export { drizzle } from 'drizzle-orm/d1';
export { eq, and, or, isNull, isNotNull, desc, asc, like, gte, lte, inArray } from 'drizzle-orm';

// Database connection pool and error handling
export interface DatabaseConfig {
  maxRetries?: number;
  retryDelay?: number;
  connectionTimeout?: number;
}

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DatabaseConnectionPool {
  private config: DatabaseConfig;
  private connections: Map<string, any> = new Map();

  constructor(config: DatabaseConfig = {}) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      connectionTimeout: 5000,
      ...config,
    };
  }

  async getConnection(database: D1Database, tenantId?: string): Promise<any> {
    const connectionKey = tenantId || 'default';
    
    if (this.connections.has(connectionKey)) {
      return this.connections.get(connectionKey);
    }

    try {
      const db = drizzle(database);
      this.connections.set(connectionKey, db);
      return db;
    } catch (error) {
      throw new DatabaseError(
        'Failed to create database connection',
        'CONNECTION_ERROR',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries: number = this.config.maxRetries!
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await this.delay(this.config.retryDelay!);
        return this.executeWithRetry(operation, retries - 1);
      }
      
      throw new DatabaseError(
        'Database operation failed after retries',
        'OPERATION_FAILED',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private isRetryableError(error: any): boolean {
    // Define which errors are retryable
    const retryableErrors = [
      'SQLITE_BUSY',
      'SQLITE_LOCKED',
      'CONNECTION_ERROR',
      'TIMEOUT',
    ];
    
    const errorMessage = error?.message || '';
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  clearConnections(): void {
    this.connections.clear();
  }
}

// Global database pool instance
export const dbPool = new DatabaseConnectionPool();

// Helper function to get database connection with error handling
export async function getDatabaseConnection(
  database: D1Database,
  tenantId?: string
): Promise<any> {
  return dbPool.getConnection(database, tenantId);
}

// Helper function to execute database operations with retry logic
export async function executeWithRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  return dbPool.executeWithRetry(operation);
}