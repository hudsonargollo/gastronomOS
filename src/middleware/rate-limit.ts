import { Context, MiddlewareHandler } from 'hono';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (c: Context) => string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the window resets
}

// In-memory store for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Rate limiting middleware
 */
export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (c) => c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return async (c: Context, next) => {
    const key = keyGenerator(c);
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= maxRequests) {
      const rateLimitInfo: RateLimitInfo = {
        limit: maxRequests,
        remaining: 0,
        reset: Math.ceil(entry.resetTime / 1000),
      };
      
      c.set('rateLimitInfo', rateLimitInfo);
      
      return c.json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      }, 429);
    }

    // Increment counter (before processing request)
    if (!skipSuccessfulRequests && !skipFailedRequests) {
      entry.count++;
    }

    // Set rate limit info in context
    const rateLimitInfo: RateLimitInfo = {
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      reset: Math.ceil(entry.resetTime / 1000),
    };
    c.set('rateLimitInfo', rateLimitInfo);

    // Process request
    await next();

    // Adjust counter based on response status (if configured)
    const status = c.res.status;
    if (skipSuccessfulRequests && status >= 200 && status < 400) {
      entry.count = Math.max(0, entry.count - 1);
    } else if (skipFailedRequests && (status >= 400 || status >= 500)) {
      entry.count = Math.max(0, entry.count - 1);
    }
  };
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
  
  // Standard rate limiting for API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
  },
  
  // Lenient rate limiting for read operations
  read: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },
  
  // Strict rate limiting for write operations
  write: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 20, // 20 requests per minute
  },
  
  // Very strict rate limiting for bulk operations
  bulk: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5, // 5 requests per 5 minutes
  },
};

/**
 * Helper function to create rate limit middleware with predefined config
 */
export function createRateLimit(configName: keyof typeof rateLimitConfigs): MiddlewareHandler {
  return rateLimit(rateLimitConfigs[configName]);
}

/**
 * IP-based rate limiting
 */
export function ipRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>): MiddlewareHandler {
  return rateLimit({
    ...config,
    keyGenerator: (c) => {
      // Try to get real IP from various headers
      const ip = c.req.header('CF-Connecting-IP') || 
                 c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                 c.req.header('X-Real-IP') ||
                 'unknown';
      return `ip:${ip}`;
    },
  });
}

/**
 * User-based rate limiting (requires authentication)
 */
export function userRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>): MiddlewareHandler {
  return rateLimit({
    ...config,
    keyGenerator: (c) => {
      const authContext = c.get('authContext');
      if (authContext?.user_id) {
        return `user:${authContext.user_id}`;
      }
      // Fallback to IP if no user context
      const ip = c.req.header('CF-Connecting-IP') || 
                 c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                 'unknown';
      return `ip:${ip}`;
    },
  });
}

/**
 * Tenant-based rate limiting
 */
export function tenantRateLimit(config: Omit<RateLimitConfig, 'keyGenerator'>): MiddlewareHandler {
  return rateLimit({
    ...config,
    keyGenerator: (c) => {
      const authContext = c.get('authContext');
      if (authContext?.tenant_id) {
        return `tenant:${authContext.tenant_id}`;
      }
      // Fallback to IP if no tenant context
      const ip = c.req.header('CF-Connecting-IP') || 
                 c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
                 'unknown';
      return `ip:${ip}`;
    },
  });
}