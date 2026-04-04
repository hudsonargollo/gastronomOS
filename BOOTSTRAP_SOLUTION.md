# 🎯 Bootstrap Solution - Create Demo Account

## The Problem

The tenant creation endpoint requires authentication (ADMIN role), but we can't authenticate without a user, and we can't create a user without a tenant. This is a chicken-and-egg problem.

## The Solution

Created a new `/api/v1/bootstrap` endpoint that:
1. Creates the tenant (or uses existing)
2. Creates the admin user
3. Returns a JWT token
4. **No authentication required** (special endpoint for initial setup)

### Security

The bootstrap endpoint only allows creating the demo account in production:
- Email must be: `demo@gastronomos.com`
- Tenant slug must be: `demo-restaurant`
- Any other values are rejected in production

## What Was Added

### New File: `src/routes/bootstrap.ts`
- POST `/api/v1/bootstrap` endpoint
- Creates tenant + user in one request
- No authentication required
- Production-safe (only allows demo account)

### Updated Files
- ✅ `src/index.ts` - Registered bootstrap route
- ✅ `CREATE_DEMO_NOW.html` - Uses bootstrap endpoint
- ✅ `deploy-backend-now.ps1` - Quick deployment script

## How to Use

### Step 1: Deploy Backend
```powershell
.\deploy-backend-now.ps1
```

Or manually:
```powershell
npm run deploy:prod
```

### Step 2: Create Demo Account
1. Open `CREATE_DEMO_NOW.html` in browser
2. Click "CREATE DEMO ACCOUNT NOW"
3. Should work! ✅

### Step 3: Deploy Frontend
```powershell
cd gastronomos-frontend
.\deploy-frontend.ps1
```

### Step 4: Test
Go to https://gastronomos-frontend.pages.dev and click "Load Demo Credentials"

## API Endpoint Details

### POST /api/v1/bootstrap

**Request:**
```json
{
  "email": "demo@gastronomos.com",
  "password": "demo123456",
  "tenantName": "Demo Restaurant",
  "tenantSlug": "demo-restaurant"
}
```

**Response (Success):**
```json
{
  "message": "Bootstrap successful",
  "token": "eyJ...",
  "user": {
    "id": "...",
    "email": "demo@gastronomos.com",
    "role": "ADMIN",
    "tenantId": "..."
  },
  "tenant": {
    "id": "...",
    "name": "Demo Restaurant",
    "slug": "demo-restaurant"
  }
}
```

**Response (User Exists):**
```json
{
  "error": "User Already Exists",
  "message": "An account with this email already exists",
  "code": "USER_EXISTS"
}
```

## Security Notes

### Production Safety
The bootstrap endpoint in production:
- ✅ Only allows demo@gastronomos.com
- ✅ Only allows demo-restaurant slug
- ❌ Rejects any other email/tenant
- ✅ Returns 403 Forbidden for non-demo accounts

### Development/Staging
In development and staging:
- ✅ Allows any email/tenant
- ✅ Useful for testing
- ✅ Can create multiple test accounts

### After Setup
Once demo account is created:
- The endpoint can still be called (idempotent)
- Returns 409 if user already exists
- Safe to leave enabled

## Troubleshooting

### "Bootstrap endpoint only allows creating demo account"
- You're in production
- Only demo@gastronomos.com is allowed
- This is correct behavior ✅

### "User Already Exists" (409)
- Demo account already created
- This is good! ✅
- Skip to deploying frontend

### "Tenant Creation Failed"
- Check backend logs: `npx wrangler tail --env production`
- Check database connection
- Verify D1 database exists

### "Failed to fetch"
- Backend not deployed
- Check: `npx wrangler deployments list`
- Deploy: `npm run deploy:prod`

## Complete Flow

```
User clicks "CREATE DEMO ACCOUNT NOW"
  ↓
Frontend calls POST /api/v1/bootstrap
  ↓
Backend creates tenant "Demo Restaurant"
  ↓
Backend creates user demo@gastronomos.com (ADMIN)
  ↓
Backend returns JWT token
  ↓
Success! Account created ✅
```

## Files Changed

### Backend
- ✨ `src/routes/bootstrap.ts` - New bootstrap endpoint
- ✅ `src/index.ts` - Registered bootstrap route
- ✨ `deploy-backend-now.ps1` - Deployment script

### Frontend
- ✅ `CREATE_DEMO_NOW.html` - Uses bootstrap endpoint
- ✅ `gastronomos-frontend/src/lib/api.ts` - Updated login/register
- ✅ `gastronomos-frontend/src/app/page.tsx` - Updated demo login
- ✅ `gastronomos-frontend/src/app/register/page.tsx` - Updated registration

### Documentation
- ✨ `BOOTSTRAP_SOLUTION.md` - This file
- ✅ `UPDATED_CREDENTIALS.md` - Credentials reference

## Quick Commands

### Deploy Backend
```powershell
npm run deploy:prod
```

### Check Deployment
```powershell
npx wrangler deployments list
```

### View Logs
```powershell
npx wrangler tail --env production
```

### Test Bootstrap Endpoint
```javascript
fetch('https://gastronomos-production.hudsonargollo2.workers.dev/api/v1/bootstrap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@gastronomos.com',
    password: 'demo123456',
    tenantName: 'Demo Restaurant',
    tenantSlug: 'demo-restaurant'
  })
}).then(r => r.json()).then(d => console.log(d));
```

## Success Criteria

After following all steps:
- ✅ Backend deployed with bootstrap endpoint
- ✅ CREATE_DEMO_NOW.html creates account successfully
- ✅ Frontend deployed with correct API URL
- ✅ Demo login button works
- ✅ Dashboard loads

---

**Status**: ✅ Ready to deploy  
**Time**: ~5 minutes  
**Complexity**: Simple (3 commands)
