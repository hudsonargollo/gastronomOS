import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Environment bindings interface
export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  ENVIRONMENT?: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// Basic CORS
app.use('*', cors());

// Simple health check endpoint
app.get('/health', async (c) => {
  try {
    // Test database connection
    const result = await c.env.DB.prepare('SELECT 1 as test').first();
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'development',
      database: result ? 'connected' : 'disconnected',
      jwt_configured: !!c.env.JWT_SECRET
    });
  } catch (error) {
    console.error('Health check error:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

// Simple root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'GastronomOS API',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  }, 500);
});

export default app;