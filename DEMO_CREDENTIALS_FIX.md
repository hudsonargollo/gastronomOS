# Demo Credentials Fix

## Issues Fixed

### 1. Wrong API URL
**Problem**: Frontend was pointing to `https://gastronomos.clubemkt.digital/api/v1` instead of `https://api.gastronomos.clubemkt.digital/api/v1`

**Fixed in**:
- `gastronomos-frontend/.env.local`
- `gastronomos-frontend/.env.production`

### 2. Demo Button Not Working
**Problem**: The "Testar Conta Demo" button only filled in the form fields but didn't actually submit the login

**Fixed in**:
- `gastronomos-frontend/src/app/page.tsx` - Now automatically attempts login when demo button is clicked

### 3. Demo Account May Not Exist
**Problem**: No demo account was seeded in the production database

**Solution**: Created a seed script to create the demo account

## How to Fix

### Step 1: Create Demo Account

Run the seed script to create the demo account in production:

```bash
npm run seed:demo
```

This will create:
- **Email**: demo@gastronomos.com
- **Password**: demo123
- **Tenant**: Demo Restaurant

### Step 2: Redeploy Frontend

The frontend needs to be redeployed with the corrected API URL:

```bash
cd gastronomos-frontend
npm run build
```

Then deploy to Cloudflare Pages (or your hosting platform).

### Step 3: Test Demo Login

1. Go to https://gastronomos-frontend.pages.dev
2. Click "Testar Conta Demo" button
3. Should automatically log in and redirect to dashboard

## Manual Testing

If you want to test the API directly:

### Test Registration (if demo account doesn't exist)
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@gastronomos.com",
    "password": "demo123",
    "tenantName": "Demo Restaurant",
    "tenantSlug": "demo-restaurant"
  }'
```

### Test Login
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@gastronomos.com",
    "password": "demo123"
  }'
```

### Test Health Check
```bash
curl https://api.gastronomos.clubemkt.digital/health
```

## What Changed

### Frontend Code (`gastronomos-frontend/src/app/page.tsx`)

**Before**:
```typescript
const handleDemoLogin = () => {
  setFormData({
    email: 'demo@gastronomos.com',
    password: 'demo123',
  });
  toast.info(t('auth.demoCredentials'));
};
```

**After**:
```typescript
const handleDemoLogin = async () => {
  setIsLoading(true);
  
  try {
    const response = await apiClient.login('demo@gastronomos.com', 'demo123');
    apiClient.setToken(response.token);
    toast.success(t('auth.welcomeBackSuccess'));
    router.push('/dashboard');
  } catch (error) {
    // If demo account doesn't exist, fill in the form for manual submission
    setFormData({
      email: 'demo@gastronomos.com',
      password: 'demo123',
    });
    toast.error(error instanceof Error ? error.message : 'Demo account not available. Please register first.');
  } finally {
    setIsLoading(false);
  }
};
```

### Environment Files

**`.env.local` and `.env.production`**:
```env
# Before
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.clubemkt.digital/api/v1

# After
NEXT_PUBLIC_API_BASE_URL=https://api.gastronomos.clubemkt.digital/api/v1
```

## Troubleshooting

### Issue: "Failed to load resource: net::ERR_NAME_NOT_RESOLVED"
**Solution**: The API URL is incorrect. Make sure it's `https://api.gastronomos.clubemkt.digital/api/v1`

### Issue: "User not found" or "Invalid credentials"
**Solution**: Run `npm run seed:demo` to create the demo account

### Issue: "CORS error"
**Solution**: Check that the frontend URL is in the CORS whitelist in `src/index.ts`:
```typescript
origin: [
  'http://localhost:3000', 
  'https://app.gastronomos.com',
  'https://api.gastronomos.clubemkt.digital',
  'https://gastronomos-frontend.pages.dev',
  // ... other URLs
],
```

### Issue: Demo button shows loading forever
**Solution**: Check browser console for errors. Likely an API connection issue.

## Quick Commands

```bash
# Create demo account
npm run seed:demo

# Test API health
curl https://api.gastronomos.clubemkt.digital/health

# Test demo login
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gastronomos.com","password":"demo123"}'

# Rebuild frontend
cd gastronomos-frontend && npm run build

# Clean and rebuild everything
npm run clean && npm run build
cd gastronomos-frontend && npm run build
```

## Next Steps

1. ✅ Fixed API URL in environment files
2. ✅ Fixed demo button to auto-login
3. ✅ Created seed script for demo account
4. 🔄 **TODO**: Run `npm run seed:demo` to create demo account
5. 🔄 **TODO**: Redeploy frontend with new environment variables
6. 🔄 **TODO**: Test demo login on production

---

**Date**: March 31, 2026  
**Status**: Ready to deploy  
**Priority**: High - User-facing issue
