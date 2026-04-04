# WebSocket Real-Time Communication System

## Overview

This WebSocket implementation provides real-time communication for the Digital Menu, Kitchen Orchestration & Payment System. It enables instant updates across all interfaces (QR Menu, Waiter Panel, Kitchen Display, Cashier Panel) with automatic reconnection, message queuing, and graceful degradation.

## Architecture

### Backend Components

1. **WebSocketDurableObject** (`websocket-durable-object.ts`)
   - Cloudflare Durable Object managing WebSocket connections
   - Handles connection lifecycle (connect, disconnect, reconnect)
   - Maintains per-tenant connection pools
   - Queues messages for offline clients
   - Broadcasts messages to connected clients

2. **WebSocketService** (`websocket-service.ts`)
   - Service layer for WebSocket operations
   - Provides high-level broadcast methods
   - Integrates with Durable Objects
   - Handles tenant isolation

3. **WebSocket Routes** (`routes/websocket.ts`)
   - HTTP endpoints for WebSocket upgrades
   - Connection management endpoints
   - Test broadcast endpoint

4. **Order State Integration** (`order-state-websocket-integration.ts`)
   - Integrates WebSocket broadcasting with order state transitions
   - Automatically broadcasts state changes to all interfaces

### Frontend Components

1. **WebSocketService** (`gastronomos-frontend/src/lib/websocket.ts`)
   - Client-side WebSocket manager
   - Automatic reconnection with exponential backoff
   - Message queuing during disconnections
   - Persistent queue storage using localStorage
   - Connection state management

2. **React Hook** (`gastronomos-frontend/src/lib/use-websocket.ts`)
   - `useWebSocket` hook for easy React integration
   - `useWebSocketSubscription` hook for message subscriptions
   - Automatic cleanup on unmount

## Features

### Connection Management (Requirement 13.4)
- Automatic connection establishment
- Connection state tracking (DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, FAILED)
- Graceful disconnection handling
- Heartbeat/ping-pong for connection health monitoring

### Automatic Reconnection (Requirement 15.3)
- Exponential backoff strategy
- Base delay: 1 second
- Maximum delay: 30 seconds
- Maximum attempts: 10
- Formula: `delay = min(baseDelay * 2^(attempts-1), maxDelay)`

### Message Queuing (Requirement 13.5)
- Automatic message queuing during disconnections
- Persistent storage using localStorage
- Maximum queue size: 100 messages
- Maximum retry count: 3 attempts per message
- Automatic queue processing on reconnection

### Broadcast Functionality (Requirements 13.1, 13.2, 13.3)
- Order state change broadcasts
- Inventory availability updates
- Payment status updates
- New order notifications
- Order ready notifications

### Tenant Isolation
- All connections are tenant-scoped
- Messages only broadcast within tenant boundaries
- Separate Durable Object instances per tenant

## Usage

### Backend - Broadcasting Messages

```typescript
import { WebSocketService } from './services/websocket-service';

// Initialize service
const wsService = new WebSocketService(env.WEBSOCKET_DO);

// Broadcast order state change
await wsService.broadcastOrderStateChange(
  'tenant-123',
  'order-456',
  'PREPARING',
  orderData
);

// Broadcast inventory update
await wsService.broadcastInventoryUpdate(
  'tenant-123',
  'menu-item-789',
  false,
  'Out of stock'
);

// Broadcast payment status
await wsService.broadcastPaymentStatusUpdate(
  'tenant-123',
  'order-456',
  'COMPLETED',
  paymentData
);
```

### Backend - Integrated Order State Transitions

```typescript
import { createOrderStateWebSocketIntegration } from './services/order-state-websocket-integration';

// Create integrated service
const orderStateWS = createOrderStateWebSocketIntegration(
  db,
  env.WEBSOCKET_DO
);

// Transition state with automatic broadcast
const result = await orderStateWS.transitionStateWithBroadcast(
  {
    orderId: 'order-123',
    toState: OrderState.PREPARING,
    transitionedBy: 'user-456'
  },
  'tenant-123',
  orderData
);
```

### Frontend - React Hook

```typescript
import { useWebSocket } from '@/lib/use-websocket';

function KitchenDisplay() {
  const { isConnected, connectionState, subscribe } = useWebSocket({
    tenantId: 'tenant-123',
    userId: 'user-456',
    interfaceType: 'kitchen-display',
    autoConnect: true
  });

  useEffect(() => {
    // Subscribe to order state changes
    const unsubscribe = subscribe('order:state-change', (data) => {
      console.log('Order state changed:', data);
      // Update UI
    });

    return unsubscribe;
  }, [subscribe]);

  return (
    <div>
      <div>Status: {connectionState}</div>
      {/* Kitchen display UI */}
    </div>
  );
}
```

### Frontend - Direct Service Usage

```typescript
import { getWebSocketService } from '@/lib/websocket';

const ws = getWebSocketService();

// Set connection parameters
ws.setConnectionParams('tenant-123', 'user-456', 'waiter-panel');

// Connect
ws.connect();

// Subscribe to messages
const unsubscribe = ws.on('order:new', (data) => {
  console.log('New order:', data);
});

// Send message
ws.send('custom-event', { foo: 'bar' });

// Disconnect
ws.disconnect();
```

## Message Types

### Order Events
- `order:state-change` - Order state transition
- `order:new` - New order created
- `order:ready` - Order ready for pickup/delivery

### Inventory Events
- `inventory:availability-change` - Menu item availability changed

### Payment Events
- `payment:status-change` - Payment status updated

### System Events
- `ping` - Heartbeat request
- `pong` - Heartbeat response

## Configuration

### Backend Configuration (wrangler.toml)

```toml
[[durable_objects.bindings]]
name = "WEBSOCKET_DO"
class_name = "WebSocketDurableObject"
script_name = "gastronomos"
```

### Frontend Configuration (.env.local)

```env
NEXT_PUBLIC_WS_URL=wss://api.gastronomos.example.com
```

## Connection States

1. **DISCONNECTED** - Not connected, no active connection
2. **CONNECTING** - Initial connection attempt in progress
3. **CONNECTED** - Successfully connected and ready
4. **RECONNECTING** - Attempting to reconnect after disconnection
5. **FAILED** - Max reconnection attempts reached

## Error Handling

### Backend
- Graceful handling of Durable Object unavailability
- Fallback to queuing when broadcast fails
- Comprehensive error logging

### Frontend
- Automatic reconnection on connection loss
- Message queuing during offline periods
- Persistent queue storage for reliability
- User-friendly connection state indicators

## Testing

### Backend Tests
```bash
npm test -- src/services/websocket-service.test.ts
```

### Frontend Tests
```bash
cd gastronomos-frontend
npm test -- src/lib/websocket.test.ts
```

## Performance Considerations

- **Connection Pooling**: One Durable Object instance per tenant
- **Message Batching**: Messages queued and sent in batches on reconnection
- **Memory Management**: Queue size limited to 100 messages
- **Heartbeat Interval**: 30 seconds to maintain connection health
- **Exponential Backoff**: Prevents server overload during reconnection storms

## Security

- **Tenant Isolation**: All connections scoped to tenant ID
- **Authentication**: User ID passed in connection parameters
- **Message Validation**: All messages validated before broadcast
- **Rate Limiting**: Can be added at route level if needed

## Monitoring

### Connection Information
```typescript
// Get connection info for a tenant
const info = await wsService.getConnectionInfo('tenant-123');
console.log(info.connections); // Array of active connections
```

### Health Checks
- Monitor connection counts per tenant
- Track message queue sizes
- Monitor reconnection attempts
- Track broadcast success rates

## Future Enhancements

1. **Redis Integration**: For distributed message queuing across multiple workers
2. **Message Acknowledgment**: Ensure message delivery with ACK/NACK
3. **Compression**: WebSocket message compression for bandwidth optimization
4. **Binary Protocol**: More efficient binary message format
5. **Presence System**: Track online/offline status of users
6. **Typing Indicators**: Real-time typing indicators for chat features
7. **Read Receipts**: Message read status tracking

## Requirements Validation

- ✅ **Requirement 13.1**: Broadcast order state changes to all connected interfaces
- ✅ **Requirement 13.2**: Update inventory availability across all QR Menu instances
- ✅ **Requirement 13.3**: Synchronize payment status updates to all interfaces
- ✅ **Requirement 13.4**: Maintain connection state and handle reconnection gracefully
- ✅ **Requirement 13.5**: Queue updates during temporary disconnections
- ✅ **Requirement 15.3**: Automatic reconnection with exponential backoff

## Troubleshooting

### Connection Issues
1. Check WebSocket URL configuration
2. Verify Durable Object binding in wrangler.toml
3. Check browser console for connection errors
4. Verify tenant ID and interface type parameters

### Message Not Received
1. Check connection state (must be CONNECTED)
2. Verify message type subscription
3. Check tenant ID matches
4. Review browser console for errors

### Reconnection Failures
1. Check max reconnection attempts (default: 10)
2. Verify network connectivity
3. Check server availability
4. Review exponential backoff delays

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test files for usage examples
3. Check browser/server console logs
4. Contact the development team
