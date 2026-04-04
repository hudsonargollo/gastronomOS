/**
 * WebSocket API Routes
 * Real-time communication endpoints
 * Part of Digital Menu, Kitchen Orchestration & Payment System
 */

import { Hono } from 'hono';
import { WebSocketService } from '../services/websocket-service';

const app = new Hono();

// WebSocket upgrade endpoint
app.get('/ws', async (c) => {
  const upgradeHeader = c.req.header('Upgrade');
  
  if (upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426);
  }

  const tenantId = c.req.query('tenantId');
  const userId = c.req.query('userId');
  const interfaceType = c.req.query('interface');

  if (!tenantId || !interfaceType) {
    return c.json({ error: 'Missing required parameters' }, 400);
  }

  // Get Durable Object namespace from environment
  const wsNamespace = c.env.WEBSOCKET_DO as DurableObjectNamespace;
  
  if (!wsNamespace) {
    return c.json({ error: 'WebSocket service not available' }, 503);
  }

  // Get Durable Object instance for this tenant
  const id = wsNamespace.idFromName(tenantId);
  const stub = wsNamespace.get(id);

  // Forward the WebSocket upgrade request to the Durable Object
  return stub.fetch(c.req.raw);
});

// Get connection information
app.get('/ws/connections', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const wsNamespace = c.env.WEBSOCKET_DO as DurableObjectNamespace;

    if (!wsNamespace) {
      return c.json({ error: 'WebSocket service not available' }, 503);
    }

    const wsService = new WebSocketService(wsNamespace);
    const info = await wsService.getConnectionInfo(tenantId);

    return c.json(info);
  } catch (error) {
    console.error('Error getting connection info:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Test broadcast endpoint (for development/testing)
app.post('/ws/test-broadcast', async (c) => {
  try {
    const tenantId = c.get('tenantId') as string;
    const body = await c.req.json();
    const wsNamespace = c.env.WEBSOCKET_DO as DurableObjectNamespace;

    if (!wsNamespace) {
      return c.json({ error: 'WebSocket service not available' }, 503);
    }

    const wsService = new WebSocketService(wsNamespace);
    const result = await wsService.broadcast({
      tenantId,
      type: body.type || 'test',
      data: body.data || {}
    });

    return c.json(result);
  } catch (error) {
    console.error('Error broadcasting test message:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
