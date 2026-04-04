# Tenant Isolation Middleware

This document describes the tenant isolation middleware implementation for the Digital Menu, Kitchen Orchestration & Payment System.

## Overview

The tenant isolation middleware provides strict multi-tenant data isolation and access control at the API level. It ensures that:

1. Every API request includes valid tenant context
2. Users can only access data belonging to their tenant
3. Cross-tenant access attempts are blocked and logged
4. All tenant access is audited for security compliance

## Requirements Addressed

- **Requirement 8.1**: Enforce strict tenant data isolation across all operations
- **Requirement 8.2**: Validate tenant access for every API request
- **Requirement 8.4**: Prevent cross-tenant data access or visibility

## Components

### 1. `resolveTenant()`

Resolves and validates tenant context from the authenticated user's JWT token.

**Usage:**
```typescript
app.use('*', authenticate());
app.use('*', resolveTenant());
```

**Behavior:**
- Extracts tenant ID from auth context
- Validates tenant ID exists
- Stores tenant ID in context for easy access
- Logs tenant resolution events

### 2. `preventCrossTenantAccess()`

Prevents cross-tenant access by validating that all resource access is scoped to the authenticated user's tenant.

**Usage:**
```typescript
app.use('*', authenticate());
app.use('*', preventCrossTenantAccess());
```

**Behavior:**
- Checks path parameters for tenant IDs
- Checks query parameters for tenant IDs
- Checks request body for tenant IDs
- Blocks requests where tenant IDs don't match
- Logs cross-tenant access attempts

### 3. `enforceTenantIsolation()`

Combines tenant resolution and cross-tenant access prevention into a single middleware.

**Usage:**
```typescript
app.use('*', authenticate());
app.use('*', enforceTenantIsolation());
```

**Behavior:**
- Resolves tenant from auth context
- Prevents cross-tenant access
- Provides complete tenant isolation

### 4. `scopeToTenant()`

Automatically injects tenant_id filter into database queries.

**Usage:**
```typescript
app.use('*', authenticate());
app.use('*', scopeToTenant());

// In route handler:
const tenantFilter = c.get('tenantFilter');
const query = tenantFilter(db.select().from(orders));
```

### 5. `logTenantAccess()`

Logs all tenant access attempts for security auditing.

**Usage:**
```typescript
app.use('*', authenticate());
app.use('*', logTenantAccess());
```

**Behavior:**
- Logs successful tenant access
- Logs failed tenant access
- Includes request duration
- Includes user and tenant information

## Helper Functions

### `getTenantId(c: Context): string`

Gets the tenant ID from the request context.

**Usage:**
```typescript
const tenantId = getTenantId(c);
```

**Throws:** Error if tenant ID not found in context

### `validateTenantOwnership(c: Context, resourceTenantId: string): Promise<boolean>`

Validates that a resource belongs to the authenticated tenant.

**Usage:**
```typescript
const order = await getOrder(orderId);
const isOwner = await validateTenantOwnership(c, order.tenantId);

if (!isOwner) {
  return c.json({ error: 'Forbidden' }, 403);
}
```

**Returns:** `true` if resource belongs to tenant, `false` otherwise

## Security Logging

All tenant isolation middleware components log security events through the audit service:

- `TENANT_RESOLVED`: Successful tenant resolution
- `TENANT_RESOLUTION_FAILED`: Failed tenant resolution
- `TENANT_RESOLUTION_ERROR`: Error during tenant resolution
- `CROSS_TENANT_ACCESS_ATTEMPT`: Attempted cross-tenant access
- `CROSS_TENANT_CHECK_ERROR`: Error during cross-tenant check
- `UNAUTHORIZED_RESOURCE_ACCESS`: Attempted access to resource owned by different tenant
- `TENANT_ACCESS`: Successful tenant access
- `TENANT_ACCESS_FAILED`: Failed tenant access

## Complete Example

```typescript
import { Hono } from 'hono';
import { authenticate, injectTenantContext, injectAuditService } from './middleware/auth';
import { enforceTenantIsolation, getTenantId, validateTenantOwnership } from './middleware/tenant-isolation';

const app = new Hono();

// Apply middleware stack
app.use('*', authenticate());
app.use('*', injectTenantContext());
app.use('*', injectAuditService());
app.use('*', enforceTenantIsolation());

// Protected route - automatically tenant-scoped
app.get('/api/orders', async (c) => {
  const tenantId = getTenantId(c);
  const db = c.get('db');
  
  // Query is automatically scoped to tenant
  const orders = await db
    .select()
    .from(orders)
    .where(eq(orders.tenantId, tenantId));
  
  return c.json({ orders });
});

// Route with resource ownership validation
app.get('/api/orders/:orderId', async (c) => {
  const orderId = c.req.param('orderId');
  const db = c.get('db');
  
  // Fetch order
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId)
  });
  
  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }
  
  // Validate tenant ownership
  const isOwner = await validateTenantOwnership(c, order.tenantId);
  
  if (!isOwner) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  
  return c.json({ order });
});

export default app;
```

## Testing

Unit tests are provided in `tenant-isolation.test.ts`:

```bash
npm test src/middleware/tenant-isolation.test.ts
```

Tests cover:
- Tenant resolution from auth context
- Cross-tenant access prevention
- Path parameter validation
- Query parameter validation
- Request body validation
- Security logging
- Helper functions

## Best Practices

1. **Always use `enforceTenantIsolation()`** on all API routes that access tenant data
2. **Use `getTenantId()`** to get the tenant ID instead of accessing auth context directly
3. **Use `validateTenantOwnership()`** when accessing resources by ID to ensure they belong to the tenant
4. **Always include tenant_id in database queries** to ensure data isolation at the database level
5. **Monitor security logs** for cross-tenant access attempts
6. **Test tenant isolation** thoroughly in integration tests

## Performance Considerations

- Tenant resolution is cached in the request context
- Cross-tenant checks are performed once per request
- Database queries should include tenant_id in WHERE clauses for optimal performance
- Consider adding database indexes on tenant_id columns

## Security Considerations

- All cross-tenant access attempts are logged for security auditing
- Tenant IDs are validated on every request
- Resource ownership is validated before allowing access
- Security events are immutable and stored in audit logs
- Failed access attempts include detailed context for investigation

## Integration with Other Middleware

The tenant isolation middleware integrates with:

- **Authentication middleware**: Requires valid JWT token with tenant_id
- **Audit service**: Logs all security events
- **Authorization service**: Works with role-based access control
- **Database middleware**: Ensures all queries are tenant-scoped

## Troubleshooting

### "Tenant ID not found in context"

**Cause:** `getTenantId()` called before tenant resolution middleware

**Solution:** Ensure `resolveTenant()` or `enforceTenantIsolation()` is applied before the route handler

### "Cross-tenant access is not permitted"

**Cause:** Request includes tenant ID that doesn't match authenticated user's tenant

**Solution:** Verify that path parameters, query parameters, and request body don't include tenant IDs from other tenants

### "Authentication required"

**Cause:** Tenant isolation middleware called before authentication middleware

**Solution:** Ensure `authenticate()` is applied before tenant isolation middleware

## Future Enhancements

- Row-level security (RLS) at database level
- Tenant-specific rate limiting
- Tenant-specific feature flags
- Tenant-specific API quotas
- Multi-tenant query optimization
