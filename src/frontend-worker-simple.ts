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
      headers: c.req.header(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return c.json({ error: 'API proxy failed' }, 500);
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

// Simple fallback for all other routes
app.get('*', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GastronomOS</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 20px; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .info { background: #e8f4fd; padding: 15px; border-radius: 4px; margin: 20px 0; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🍽️ GastronomOS</h1>
        <div class="status">
          <strong>✅ Frontend Worker Status:</strong> Running
        </div>
        <div class="info">
          <p><strong>Environment:</strong> ${c.env?.ENVIRONMENT || 'development'}</p>
          <p><strong>API Backend:</strong> <a href="https://gastronomos-production.hudsonargollo2.workers.dev/health" target="_blank">gastronomos-production.hudsonargollo2.workers.dev</a></p>
          <p><strong>Frontend Health:</strong> <a href="/health">/health</a></p>
        </div>
        <p>The GastronomOS application is successfully deployed and running on Cloudflare Workers.</p>
        <p>The frontend application files are served as static assets, and API requests are proxied to the backend worker.</p>
      </div>
    </body>
    </html>
  `);
});

export default app;