import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Environment bindings interface
interface Env {
  ENVIRONMENT?: string;
}

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// API proxy - forward all /api requests to the backend worker
app.all('/api/*', async (c) => {
  const url = new URL(c.req.url);
  const backendUrl = `https://gastronomos-production.hudsonargollo2.workers.dev${url.pathname}${url.search}`;
  
  try {
    const response = await fetch(backendUrl, {
      method: c.req.method,
      headers: {
        ...Object.fromEntries(c.req.header()),
        'Origin': 'https://gastronomos.clubemkt.digital',
        'Referer': 'https://gastronomos.clubemkt.digital'
      },
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Skip headers that might cause issues
      if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // Ensure CORS headers are set
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return c.json({ 
      error: 'API proxy failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      backend: 'gastronomos-production.hudsonargollo2.workers.dev'
    }, 500);
  }
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'healthy', 
    service: 'frontend-worker',
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development'
  });
});

export default app;