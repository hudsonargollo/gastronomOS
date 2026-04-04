# Demo Session Management

## Overview

The Demo Session Management system provides enhanced security and automatic maintenance for demo accounts in GastronomOS. This system ensures demo accounts have appropriate restrictions and that demo data remains fresh through automatic resets.

**Requirements: 8.5** - Configure shorter expiration times, implement automatic reset, add security measures

## Features

### 1. Shorter Session Expiration

Demo sessions expire after **2 hours** (compared to 24 hours for regular sessions) to:
- Reduce security risks from shared demo credentials
- Encourage users to sign up for real accounts
- Limit exposure of demo data

### 2. Automatic Demo Data Reset

Demo data is automatically reset on a schedule (default: daily at 2 AM UTC) to:
- Maintain clean, consistent demo environment
- Remove any test data created by users
- Ensure demo always shows realistic sample data

### 3. Security Restrictions

Demo accounts have the following restrictions:
- **Cannot modify users**: Prevents creation/modification of user accounts
- **Cannot delete data**: Prevents permanent data deletion
- **Cannot export data**: Prevents data export operations
- **Cannot access admin panel**: Restricts access to admin features
- **Data retention limit**: Demo data resets after configured interval

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Demo Session Manager                      │
├─────────────────────────────────────────────────────────────┤
│  • Session Expiration (2 hours)                             │
│  • Demo Account Detection                                    │
│  • Security Restrictions                                     │
│  • Reset Scheduling                                          │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ JWT Service  │   │ Auth Routes  │   │ Demo Routes  │
│              │   │              │   │              │
│ • Custom     │   │ • Demo Login │   │ • Manual     │
│   Expiration │   │ • Session    │   │   Reset      │
│              │   │   Detection  │   │ • Config     │
└──────────────┘   └──────────────┘   └──────────────┘
                            │
                            ▼
                   ┌──────────────┐
                   │ Cron Handler │
                   │              │
                   │ • Scheduled  │
                   │   Reset      │
                   └──────────────┘
```

## Usage

### Detecting Demo Accounts

```typescript
import { createDemoSessionManager } from './services/demo-session-manager';

const demoSessionManager = createDemoSessionManager(db);

// Check if email is a demo account
const isDemo = await demoSessionManager.isDemoAccount('demo@gastronomos.com');

// Check if tenant is demo tenant
const isDemoTenant = demoSessionManager.isDemoTenant('demo-tenant');
```

### Creating Demo Sessions

```typescript
// In auth routes
const demoExpiration = demoSessionManager.getDemoSessionExpiration();
const token = await jwtService.sign(claims, demoExpiration);
```

### Enforcing Security Restrictions

```typescript
import { 
  preventDemoUserModification,
  preventDemoDataDeletion,
  preventDemoDataExport,
  preventDemoAdminAccess 
} from './middleware/demo-security';

// Protect user management endpoints
app.post('/users', preventDemoUserModification(), createUser);

// Protect deletion endpoints
app.delete('/data/:id', preventDemoDataDeletion(), deleteData);

// Protect export endpoints
app.get('/export', preventDemoDataExport(), exportData);

// Protect admin endpoints
app.use('/admin/*', preventDemoAdminAccess());
```

### Manual Demo Reset

```typescript
// Via API endpoint
POST /demo/reset

// Response:
{
  "success": true,
  "data": {
    "message": "Demo data reset completed successfully",
    "timestamp": "2024-01-22T02:00:00.000Z",
    "warning": "All previous demo data has been replaced with fresh sample data",
    "nextAutoReset": "Demo data will automatically reset daily at 2 AM UTC"
  }
}
```

### Getting Session Configuration

```typescript
// Via API endpoint
GET /demo/session-config

// Response:
{
  "success": true,
  "data": {
    "sessionConfig": {
      "expirationHours": 2,
      "resetIntervalHours": 24,
      "maxConcurrentSessions": 100,
      "autoResetEnabled": true
    },
    "securityRestrictions": {
      "canModifyUsers": false,
      "canDeleteData": false,
      "canExportData": false,
      "canAccessAdminPanel": false,
      "maxDataRetentionHours": 24
    }
  }
}
```

## Configuration

### Cloudflare Cron Triggers

Add to `wrangler.toml`:

```toml
[triggers]
crons = ["0 2 * * *"]  # Reset demo data daily at 2 AM UTC
```

### Custom Configuration

```typescript
const demoSessionManager = createDemoSessionManager(db, {
  expirationSeconds: 2 * 60 * 60,    // 2 hours
  resetIntervalHours: 24,             // Reset daily
  maxConcurrentSessions: 100,         // Max concurrent demo sessions
  enableAutoReset: true               // Enable automatic reset
});
```

## Demo Account Patterns

The system automatically detects demo accounts by email patterns:
- `@gastronomos.com` - Official demo accounts
- `@demo-restaurant.com` - Demo restaurant accounts
- `demo@` - Any email starting with "demo@"

Or by tenant ID:
- `demo-tenant` - The demo tenant ID

## Security Considerations

### Why Shorter Expiration?

Demo credentials are publicly available, so shorter sessions:
1. Limit the window for potential abuse
2. Reduce the impact of session hijacking
3. Encourage users to create real accounts

### Why Restrict Operations?

Demo accounts are restricted to:
1. Prevent spam or malicious data creation
2. Maintain demo data quality
3. Protect system resources
4. Ensure consistent demo experience

### Why Automatic Reset?

Automatic resets ensure:
1. Demo always shows clean, realistic data
2. No accumulation of test data
3. Consistent experience for all demo users
4. Reduced maintenance burden

## Monitoring

### Audit Logging

All demo session activities are logged:
- Demo login attempts
- Session expiration
- Security restriction violations
- Manual and automatic resets

### Metrics to Monitor

- Demo session count
- Demo session duration
- Reset frequency
- Security restriction hits
- Demo account usage patterns

## Troubleshooting

### Demo Sessions Expiring Too Quickly

Check the configuration:
```typescript
const config = demoSessionManager.getConfig();
console.log('Expiration hours:', config.expirationSeconds / 3600);
```

### Demo Data Not Resetting

1. Check if auto-reset is enabled
2. Verify cron trigger configuration in wrangler.toml
3. Check cron execution logs
4. Manually trigger reset via `/demo/reset` endpoint

### Security Restrictions Not Working

1. Verify middleware is applied to routes
2. Check demo account detection logic
3. Review audit logs for restriction violations

## API Reference

### DemoSessionManager

```typescript
interface IDemoSessionManager {
  getDemoSessionExpiration(): number;
  isDemoAccount(email: string): Promise<boolean>;
  isDemoTenant(tenantId: string): boolean;
  createDemoSessionInfo(userId: string, tenantId: string): DemoSessionInfo;
  shouldResetDemoData(): Promise<boolean>;
  scheduleDemoReset(): Promise<void>;
  getSessionSecurityRestrictions(): DemoSecurityRestrictions;
}
```

### Security Middleware

```typescript
// Prevent user modifications
preventDemoUserModification(): MiddlewareHandler

// Prevent data deletion
preventDemoDataDeletion(): MiddlewareHandler

// Prevent data export
preventDemoDataExport(): MiddlewareHandler

// Prevent admin access
preventDemoAdminAccess(): MiddlewareHandler

// Add demo session headers
addDemoSessionHeaders(): MiddlewareHandler
```

## Testing

Run the test suite:
```bash
npm test -- src/services/demo-session-manager.test.ts
```

Test coverage includes:
- Session expiration configuration
- Demo account detection
- Security restrictions
- Reset scheduling logic
- Configuration management

## Future Enhancements

Potential improvements:
1. Per-user demo session tracking
2. Demo session analytics dashboard
3. Configurable reset schedules per tenant
4. Demo session rate limiting
5. Demo data versioning
6. A/B testing for demo experiences
