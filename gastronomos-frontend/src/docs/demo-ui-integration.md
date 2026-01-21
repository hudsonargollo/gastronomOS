# Demo UI Integration

## Overview

The demo UI integration provides a seamless way for potential customers to test the GastronomOS platform using pre-configured demo credentials. This feature implements requirements 8.2 and 8.3 from the multi-tenant authentication specification.

## Features

### Demo Button
- Located on the login page below the main sign-in button
- Clearly labeled with a sparkle icon to indicate it's a special feature
- Fetches demo credentials from the backend API when clicked
- Automatically populates the login form with demo credentials

### User Experience Flow

1. User visits the login page
2. User clicks the "Try Demo" button
3. System fetches demo credentials from `/api/v1/demo/credentials`
4. Login form is automatically populated with:
   - Email: `demo@gastronomos.com`
   - Password: `demo123`
5. User clicks "Sign In" to authenticate with demo credentials
6. User is redirected to the dashboard with full demo access

### Loading States

The demo button provides visual feedback during the credential loading process:
- **Normal State**: Shows "Try Demo" with sparkle icon
- **Loading State**: Shows spinner with "Loading demo..." text
- **Disabled State**: Button is disabled while loading or during login

### Error Handling

If the demo credentials API fails:
- User sees an error toast notification
- Form remains empty
- User can try again or enter credentials manually

## API Integration

### Endpoint
```
GET /api/v1/demo/credentials
```

### Response Format
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "role": "admin",
        "email": "demo@gastronomos.com",
        "password": "demo123",
        "description": "Full system access with all permissions"
      },
      {
        "role": "manager",
        "email": "manager@demo-restaurant.com",
        "password": "manager123",
        "description": "Location manager with inventory and purchasing access"
      },
      {
        "role": "staff",
        "email": "staff@demo-restaurant.com",
        "password": "staff123",
        "description": "Basic staff access for inventory viewing"
      }
    ],
    "defaultAccount": {
      "role": "admin",
      "email": "demo@gastronomos.com",
      "password": "demo123",
      "description": "Full system access with all permissions"
    },
    "message": "Demo credentials retrieved successfully"
  }
}
```

## Implementation Details

### Frontend Components

#### Login Page (`src/app/page.tsx`)
- Implements the demo button UI
- Handles demo credential loading
- Manages form state and loading states
- Integrates with authentication flow

#### API Client (`src/lib/api.ts`)
- Provides `getDemoCredentials()` method
- Returns typed response with demo account information
- Handles API errors gracefully

### Backend Endpoints

#### Demo Credentials Endpoint (`src/index.ts`)
- Public endpoint (no authentication required)
- Returns demo account information
- Supports multiple demo accounts with different roles

## Security Considerations

### Demo Account Isolation
- Demo accounts are completely isolated from production data
- Demo tenant has its own separate data space
- Demo data resets automatically to prevent pollution

### Credential Exposure
- Demo credentials are intentionally public for evaluation purposes
- Demo accounts have limited permissions and access
- Demo sessions have shorter expiration times (2 hours vs 24 hours)

### Rate Limiting
- Demo credentials endpoint is subject to standard rate limiting
- Prevents abuse of the demo system
- Ensures fair access for all potential customers

## Testing

### API Integration Tests
Location: `src/test/demo-api-integration.test.ts`

Tests verify:
- Demo credentials can be fetched from the API
- Multiple demo accounts are returned
- Accounts have all required fields
- Default account is properly configured

### Manual Testing Checklist

1. **Demo Button Visibility**
   - [ ] Demo button is visible on login page
   - [ ] Button has sparkle icon and clear label
   - [ ] Button is styled consistently with design system

2. **Credential Loading**
   - [ ] Clicking demo button fetches credentials
   - [ ] Loading state is displayed during fetch
   - [ ] Form is populated with demo credentials
   - [ ] Success toast is shown

3. **Error Handling**
   - [ ] API errors show error toast
   - [ ] Form remains empty on error
   - [ ] User can retry after error

4. **Authentication Flow**
   - [ ] Demo credentials can be used to log in
   - [ ] User is redirected to dashboard
   - [ ] Demo data is accessible
   - [ ] Session works correctly

## Future Enhancements

### Multiple Demo Accounts
- Add UI to select between different demo roles
- Show role descriptions before loading credentials
- Allow users to try different permission levels

### Demo Tour
- Integrate with product tour system
- Highlight key features for demo users
- Provide guided walkthrough of platform

### Demo Data Reset
- Add UI to manually reset demo data
- Show demo data age/freshness
- Notify users when demo data is reset

## Related Documentation

- [Multi-Tenant Authentication Specification](../../.kiro/specs/multi-tenant-auth/design.md)
- [Demo Data Seeding](../../../src/services/README-demo-data.md)
- [Authentication Flow](./authentication-flow.md)

## Support

For issues or questions about the demo UI integration:
1. Check the API endpoint is accessible
2. Verify demo data is seeded in the database
3. Check browser console for errors
4. Review API client configuration
