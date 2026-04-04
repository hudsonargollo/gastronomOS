/**
 * Database Connection Pooling and Optimization
 * Manages database connections with pooling, optimization, and monitoring
 * 
 * Requirements: All system integration requirements
 * - Create database connection pooling and optimization
 * - Monitor connection health
 * - Provide query optimization
 */

import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

// Connection pool configuration
export interface PoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
  connectionTimeout: number; // milliseconds
  queryTimeout: number; // milliseconds
  enableWal: boolean;
  enableForeignKeys: boolean;
  pragmas: Record<string, string | number | boolean>;
}

// Connection statistics
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  lastError?: string;
  lastErrorTime?: number;
}

// Query performance metrics
export interface QueryMetrics {
  query: string;
  executionTime: number;
  rowsAffected: number;
  timestamp: number;
  error?: string;
}

// Default pool configuration
const DEFAULT_POOL_CONFIG: PoolConfig = {
  minConnections: 1,
  maxConnections: 10,
  acquireTimeout: 30000,
  idleTimeout: 300000, // 5 minutes
  connectionTimeout: 10000,
  queryTimeout: 30000,
  enableWal: true,
  enableForeignKeys: true,
  pragmas: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    cache_size: -64000, // 64MB
    temp_store: 'MEMORY',
    mmap_size: 268435456, // 256MB
    page_size: 4096,
  },
};

/**
 * Database Connection Pool
 * Manages database connections with pooling and optimization
 */
export class DatabasePool {
  private db: DrizzleD1Database<typeof schema> | null = null;
  private d1Database: D1Database | null = null;
  private config: PoolConfig;
  private stats: ConnectionStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalQueries: 0,
    failedQueries: 0,
    averageQueryTime: 0,
  };
  private queryMetrics: QueryMetrics[] = [];
  private maxMetricsHistory: number = 1000;
  private isInitialized: boolean = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /**
   * Initialize the connection pool
   */
  async initialize(d1Database: D1Database): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.d1Database = d1Database;
    
    // Initialize Drizzle ORM with D1 database
    this.db = drizzle(d1Database, { schema });
    
    // Apply SQLite pragmas for optimization
    await this.applyPragmas();
    
    // Start health check interval
    this.startHealthCheck();
    
    this.isInitialized = true;
    this.stats.totalConnections = 1;
    this.stats.idleConnections = 1;
  }

  /**
   * Apply SQLite pragmas for performance optimization
   */
  private async applyPragmas(): Promise<void> {
    if (!this.d1Database) return;

    const pragmas = Object.entries(this.config.pragmas)
      .map(([key, value]) => `PRAGMA ${key} = ${typeof value === 'string' ? `'${value}'` : value}`)
      .join('; ');

    try {
      await this.d1Database.exec(pragmas);
    } catch (error) {
      console.error('Failed to apply pragmas:', error);
    }
  }

  /**
   * Get the database instance
   */
  getDb(): DrizzleD1Database<typeof schema> {
    if (!this.db) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a query with monitoring
   */
  async executeQuery<T>(
    queryFn: (db: DrizzleD1Database<typeof schema>) => Promise<T>,
    queryName?: string
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    this.stats.activeConnections++;
    this.stats.idleConnections = Math.max(0, this.stats.idleConnections - 1);

    try {
      const result = await queryFn(this.db);
      
      const executionTime = Date.now() - startTime;
      this.recordQueryMetrics(queryName || 'anonymous', executionTime, 0);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.failedQueries++;
      
      this.recordQueryMetrics(
        queryName || 'anonymous',
        executionTime,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.stats.lastErrorTime = Date.now();
      
      throw error;
    } finally {
      this.stats.activeConnections--;
      this.stats.idleConnections++;
      this.stats.totalQueries++;
    }
  }

  /**
   * Execute a transaction with monitoring
   */
  async executeTransaction<T>(
    transactionFn: (db: DrizzleD1Database<typeof schema>) => Promise<T>,
    transactionName?: string
  ): Promise<T> {
    if (!this.db) {
      throw new Error('Database pool not initialized');
    }

    const startTime = Date.now();
    this.stats.activeConnections++;

    try {
      const result = await this.db.transaction(async (tx) => {
        return await transactionFn(tx as any);
      });
      
      const executionTime = Date.now() - startTime;
      this.recordQueryMetrics(transactionName || 'transaction', executionTime, 0);
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.stats.failedQueries++;
      
      this.recordQueryMetrics(
        transactionName || 'transaction',
        executionTime,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.stats.lastErrorTime = Date.now();
      
      throw error;
    } finally {
      this.stats.activeConnections--;
      this.stats.totalQueries++;
    }
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(
    query: string,
    executionTime: number,
    rowsAffected: number,
    error?: string
  ): void {
    const metrics: QueryMetrics = {
      query,
      executionTime,
      rowsAffected,
      timestamp: Date.now(),
      error,
    };

    this.queryMetrics.push(metrics);
    
    // Keep only the last N metrics
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics.shift();
    }

    // Update average query time
    const totalTime = this.queryMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    this.stats.averageQueryTime = totalTime / this.queryMetrics.length;
  }

  /**
   * Start health check interval
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check database health
   */
  async checkHealth(): Promise<{ healthy: boolean; latency: number; error?: string }> {
    if (!this.d1Database) {
      return { healthy: false, latency: 0, error: 'Database not initialized' };
    }

    const startTime = Date.now();
    
    try {
      const result = await this.d1Database.prepare('SELECT 1 as health_check').first();
      const latency = Date.now() - startTime;
      
      return {
        healthy: result?.health_check === 1,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Get query metrics history
   */
  getQueryMetrics(limit: number = 100): QueryMetrics[] {
    return this.queryMetrics.slice(-limit);
  }

  /**
   * Get slow queries
   */
  getSlowQueries(thresholdMs: number = 1000): QueryMetrics[] {
    return this.queryMetrics.filter(m => m.executionTime > thresholdMs);
  }

  /**
   * Get failed queries
   */
  getFailedQueries(): QueryMetrics[] {
    return this.queryMetrics.filter(m => m.error);
  }

  /**
   * Optimize database
   */
  async optimize(): Promise<void> {
    if (!this.d1Database) return;

    try {
      // Analyze tables for query optimization
      await this.d1Database.exec('ANALYZE');
      
      // Vacuum to reclaim space and optimize
      await this.d1Database.exec('VACUUM');
    } catch (error) {
      console.error('Database optimization failed:', error);
    }
  }

  /**
   * Get database size information
   */
  async getDatabaseSize(): Promise<{ pageSize: number; pageCount: number; sizeBytes: number }> {
    if (!this.d1Database) {
      return { pageSize: 0, pageCount: 0, sizeBytes: 0 };
    }

    try {
      const result = await this.d1Database
        .prepare('PRAGMA page_count')
        .first() as any;
      
      const pageCount = result?.page_count || 0;
      const pageSize = this.config.pragmas.page_size as number || 4096;
      
      return {
        pageSize,
        pageCount,
        sizeBytes: pageSize * pageCount,
      };
    } catch (error) {
      console.error('Failed to get database size:', error);
      return { pageSize: 0, pageCount: 0, sizeBytes: 0 };
    }
  }

  /**
   * Get table statistics
   */
  async getTableStats(): Promise<Record<string, { count: number; name: string }>> {
    if (!this.d1Database) {
      return {};
    }

    const tables = [
      'tenants', 'locations', 'users', 'products', 'categories',
      'orders', 'order_items', 'payments', 'commissions',
      'inventory_items', 'transfers', 'allocations',
      'audit_logs', 'receipts', 'purchase_orders',
    ];

    const stats: Record<string, { count: number; name: string }> = {};

    for (const table of tables) {
      try {
        const result = await this.d1Database
          .prepare(`SELECT COUNT(*) as count FROM ${table}`)
          .first() as any;
        
        stats[table] = {
          count: result?.count || 0,
          name: table,
        };
      } catch {
        // Table might not exist
        stats[table] = { count: 0, name: table };
      }
    }

    return stats;
  }

  /**
   * Dispose of the connection pool
   */
  async dispose(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.db = null;
    this.d1Database = null;
    this.isInitialized = false;
    this.queryMetrics = [];
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
    };
  }
}

// Singleton instance
let poolInstance: DatabasePool | null = null;

/**
 * Get or create the database pool singleton
 */
export function getDatabasePool(config?: Partial<PoolConfig>): DatabasePool {
  if (!poolInstance) {
    poolInstance = new DatabasePool(config);
  }
  return poolInstance;
}

/**
 * Initialize the database pool
 */
export async function initializeDatabasePool(
  d1Database: D1Database,
  config?: Partial<PoolConfig>
): Promise<DatabasePool> {
  const pool = getDatabasePool(config);
  await pool.initialize(d1Database);
  return pool;
}

/**
 * Reset the database pool (useful for testing)
 */
export function resetDatabasePool(): void {
  if (poolInstance) {
    poolInstance.dispose().catch(console.error);
    poolInstance = null;
  }
}