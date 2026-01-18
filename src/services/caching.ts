import { z } from 'zod';

/**
 * Caching Service
 * Requirements: 9.4, 9.6
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean;
  serialize?: boolean;
}

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  hits: number;
  size: number;
}

export interface CacheStats {
  totalKeys: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictions: number;
  memoryUsage: number;
}

/**
 * In-Memory Cache Implementation
 */
export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    deletes: 0,
  };
  private maxSize: number;
  private maxMemory: number;

  constructor(options: {
    maxSize?: number;
    maxMemory?: number; // in bytes
  } = {}) {
    this.maxSize = options.maxSize || 10000;
    this.maxMemory = options.maxMemory || 100 * 1024 * 1024; // 100MB
    
    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count
    entry.hits++;
    this.stats.hits++;
    
    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    const {
      ttl = 3600, // 1 hour default
      tags = [],
      compress = false,
      serialize = true,
    } = options;

    // Calculate size
    const serializedValue = serialize ? JSON.stringify(value) : value;
    const size = this.calculateSize(serializedValue);

    // Check memory limits
    if (this.getCurrentMemoryUsage() + size > this.maxMemory) {
      await this.evictLRU();
    }

    // Check size limits
    if (this.cache.size >= this.maxSize) {
      await this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + (ttl * 1000),
      tags,
      hits: 0,
      size,
    };

    this.cache.set(key, entry);
    this.stats.sets++;
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Invalidate cache entries by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    return invalidated;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalKeys: this.cache.size,
      totalSize: this.getCurrentMemoryUsage(),
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      evictions: this.stats.evictions,
      memoryUsage: this.getCurrentMemoryUsage(),
    };
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry info
   */
  getEntryInfo(key: string): Omit<CacheEntry, 'value'> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const { value, ...info } = entry;
    return info;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    if (this.cache.size === 0) return;
    
    // Find entry with lowest hit count and oldest creation time
    let lruKey: string | null = null;
    let lruScore = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      // Score based on hits and age (lower is more likely to be evicted)
      const age = Date.now() - entry.createdAt;
      const score = entry.hits - (age / 1000000); // Normalize age to seconds
      
      if (score < lruScore) {
        lruScore = score;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.cache.delete(lruKey);
      this.stats.evictions++;
    }
  }

  /**
   * Calculate memory usage of a value
   */
  private calculateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // Rough estimate for UTF-16
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    
    return 8; // Default size for primitives
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      sets: 0,
      deletes: 0,
    };
  }
}

/**
 * Cache Service with multiple backends
 */
export class CacheService {
  private memoryCache: MemoryCache;
  private redisCache?: any; // Redis client would go here

  constructor(options: {
    memory?: {
      maxSize?: number;
      maxMemory?: number;
    };
    redis?: {
      host: string;
      port: number;
      password?: string;
    };
  } = {}) {
    this.memoryCache = new MemoryCache(options.memory);
    
    // Initialize Redis if configured
    if (options.redis) {
      // In a real implementation, you would initialize Redis client here
      console.log('Redis cache not implemented in this demo');
    }
  }

  /**
   * Get value from cache (tries memory first, then Redis)
   */
  async get<T>(key: string): Promise<T | null> {
    // Try memory cache first
    const memoryResult = await this.memoryCache.get<T>(key);
    if (memoryResult !== null) {
      return memoryResult;
    }

    // Try Redis cache if available
    if (this.redisCache) {
      // Redis implementation would go here
    }

    return null;
  }

  /**
   * Set value in cache (sets in both memory and Redis)
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    // Set in memory cache
    await this.memoryCache.set(key, value, options);

    // Set in Redis cache if available
    if (this.redisCache) {
      // Redis implementation would go here
    }
  }

  /**
   * Delete from all caches
   */
  async delete(key: string): Promise<boolean> {
    const memoryDeleted = await this.memoryCache.delete(key);
    
    if (this.redisCache) {
      // Redis delete would go here
    }
    
    return memoryDeleted;
  }

  /**
   * Cache a function result
   */
  async cached<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn();
    await this.set(key, result, options);
    
    return result;
  }

  /**
   * Cache with automatic key generation
   */
  async cacheFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    keyGenerator: (...args: T) => string,
    options: CacheOptions = {}
  ): Promise<(...args: T) => Promise<R>> {
    return async (...args: T): Promise<R> => {
      const key = keyGenerator(...args);
      return this.cached(key, () => fn(...args), options);
    };
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const keys = this.memoryCache.getKeys();
    const regex = new RegExp(pattern);
    let invalidated = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        await this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    return this.memoryCache.invalidateByTags(tags);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.memoryCache.getStats();
  }

  /**
   * Warm up cache with data
   */
  async warmUp(data: Array<{ key: string; value: any; options?: CacheOptions }>): Promise<void> {
    for (const item of data) {
      await this.set(item.key, item.value, item.options);
    }
  }
}

/**
 * Cache middleware for HTTP responses
 */
export function cacheMiddleware(cacheService: CacheService, options: {
  defaultTTL?: number;
  keyGenerator?: (c: any) => string;
  shouldCache?: (c: any) => boolean;
} = {}) {
  const {
    defaultTTL = 300, // 5 minutes
    keyGenerator = (c) => `${c.req.method}:${c.req.path}:${JSON.stringify(c.req.query())}`,
    shouldCache = (c) => c.req.method === 'GET',
  } = options;

  return async (c: any, next: any) => {
    // Only cache GET requests by default
    if (!shouldCache(c)) {
      return await next();
    }

    const cacheKey = keyGenerator(c);
    
    // Try to get from cache
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      c.header('X-Cache', 'HIT');
      return c.json(cached);
    }

    // Execute request
    await next();

    // Cache successful responses
    if (c.res.status >= 200 && c.res.status < 300) {
      try {
        const responseBody = await c.res.clone().json();
        
        // Determine TTL from response headers or use default
        const cacheControl = c.res.headers.get('Cache-Control');
        let ttl = defaultTTL;
        
        if (cacheControl) {
          const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
          if (maxAgeMatch) {
            ttl = parseInt(maxAgeMatch[1], 10);
          }
        }

        // Cache the response
        await cacheService.set(cacheKey, responseBody, { ttl });
        c.header('X-Cache', 'MISS');
      } catch (error) {
        // If response is not JSON, don't cache
        console.warn('Could not cache non-JSON response');
      }
    }
  };
}

/**
 * Cache utilities
 */
export const cacheUtils = {
  /**
   * Generate cache key from object
   */
  generateKey(prefix: string, obj: Record<string, any>): string {
    const sortedKeys = Object.keys(obj).sort();
    const keyParts = sortedKeys.map(key => `${key}:${obj[key]}`);
    return `${prefix}:${keyParts.join(':')}`;
  },

  /**
   * Generate cache key with hash
   */
  generateHashKey(prefix: string, data: string): string {
    // Simple hash function (in production, use a proper hash function)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${prefix}:${Math.abs(hash).toString(36)}`;
  },

  /**
   * Parse cache control header
   */
  parseCacheControl(header: string): {
    maxAge?: number;
    noCache?: boolean;
    noStore?: boolean;
    mustRevalidate?: boolean;
  } {
    const directives: any = {};
    
    header.split(',').forEach(directive => {
      const [key, value] = directive.trim().split('=');
      
      switch (key.toLowerCase()) {
        case 'max-age':
          directives.maxAge = parseInt(value, 10);
          break;
        case 'no-cache':
          directives.noCache = true;
          break;
        case 'no-store':
          directives.noStore = true;
          break;
        case 'must-revalidate':
          directives.mustRevalidate = true;
          break;
      }
    });
    
    return directives;
  },

  /**
   * Format cache size
   */
  formatCacheSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  },

  /**
   * Calculate cache hit ratio
   */
  calculateHitRatio(hits: number, misses: number): number {
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  },
};