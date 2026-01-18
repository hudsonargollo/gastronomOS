import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getAssetFromKV, MethodNotAllowedError, NotFoundError } from '@cloudflare/kv-asset-handler';

// Environment bindings interface
interface Env {
  __STATIC_CONTENT: KVNamespace;
  __STATIC_CONTENT_MANIFEST: string;
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

// Serve static frontend files using Workers Sites
app.get('*', async (c) => {
  try {
    const event = {
      request: c.req.raw,
      waitUntil: () => {},
    };

    return await getAssetFromKV(event, {
      ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
      ASSET_MANIFEST: JSON.parse(c.env.__STATIC_CONTENT_MANIFEST),
      mapRequestToAsset: (request: Request) => {
        const url = new URL(request.url);
        let pathname = url.pathname;

        // Handle Next.js routing
        if (pathname === '/' || pathname === '') {
          pathname = '/index.html';
        } else if (!pathname.includes('.') && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
          // For SPA routing, serve index.html for routes without extensions
          pathname = '/index.html';
        }

        return new Request(`${url.origin}${pathname}`, {
          method: request.method,
          headers: request.headers,
        });
      },
      cacheControl: {
        browserTTL: null,
        edgeTTL: 2 * 60 * 60 * 24, // 2 days
        bypassCache: false,
      },
    });
  } catch (e) {
    if (e instanceof NotFoundError) {
      // If asset not found, try to serve index.html for SPA routing
      try {
        const event = {
          request: new Request(`${new URL(c.req.url).origin}/index.html`),
          waitUntil: () => {},
        };

        return await getAssetFromKV(event, {
          ASSET_NAMESPACE: c.env.__STATIC_CONTENT,
          ASSET_MANIFEST: JSON.parse(c.env.__STATIC_CONTENT_MANIFEST),
        });
      } catch (fallbackError) {
        return c.text('Not Found', 404);
      }
    } else if (e instanceof MethodNotAllowedError) {
      return c.text('Method Not Allowed', 405);
    } else {
      console.error('Asset serving error:', e);
      return c.text('Internal Server Error', 500);
    }
  }
});

export default app;