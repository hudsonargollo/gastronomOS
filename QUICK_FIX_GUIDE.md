# Quick Fix Guide - Demo Credentials Not Working

## Problem
The "Testar Conta Demo" button is not working because:
1. ❌ Wrong API URL in frontend configuration
2. ❌ Demo button only fills form, doesn't submit
3. ❌ Demo account may not exist in database

## Solution (3 Steps)

### Step 1: Create Demo Account ⚡

**Option A - Using Browser (Easiest)**:
1. Open: https://api.gastronomos.clubemkt.digital/api/v1/auth/register
2. Or use Postman/Insomnia with this request:

```json
POST https://api.gastronomos.clubemkt.digital/api/v1/auth/register
Content-Type: application/json

{
  "email": "demo@gastronomos.com",
  "password": "demo123",
  "tenantName": "Demo Restaurant",
  "tenantSlug": "demo-restaurant"
}
```

**Option B - Using Command Line**:
```bash
# Windows (PowerShell)
Invoke-RestMethod -Uri "https://api.gastronomos.clubemkt.digital/api/v1/auth/register" -Method Post -ContentType "application/json" -Body '{"email":"demo@gastronomos.com","password":"demo123","tenantName":"Demo Restaurant","tenantSlug":"demo-restaurant"}'

# Or run the batch file
scripts\create-demo-account.bat
```

### Step 2: Verify Demo Login Works 🔍

Test the login endpoint:

```bash
# PowerShell
Invoke-RestMethod -Uri "https://api.gastronomos.clubemkt.digital/api/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"demo@gastronomos.com","password":"demo123"}'
```

You should get a response with a token.

### Step 3: Redeploy Frontend 🚀

The frontend needs the corrected API URL:

```bash
cd gastronomos-frontend
npm run build
```

Then deploy to Cloudflare Pages.

## What Was Fixed

### ✅ Fixed Files

1. **gastronomos-frontend/.env.local**
   - Changed: `https://gastronomos.clubemkt.digital/api/v1`
   - To: `https://api.gastronomos.clubemkt.digital/api/v1`

2. **gastronomos-frontend/.env.production**
   - Changed: `https://gastronomos.clubemkt.digital/api/v1`
   - To: `https://api.gastronomos.clubemkt.digital/api/v1`

3. **gastronomos-frontend/src/app/page.tsx**
   - Demo button now automatically attempts login
   - Shows proper error messages if account doesn't exist

### ✅ New Scripts Created

- `scripts/seed-demo-data.js` - Node.js seed script
- `scripts/seed-demo-data.ps1` - PowerShell seed script
- `scripts/create-demo-account.bat` - Windows batch file
- `npm run seed:demo` - NPM command to seed demo data

## Testing

### Test API Health
```bash
curl https://api.gastronomos.clubemkt.digital/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-31T...",
  "environment": "production"
}
```

### Test Demo Login
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gastronomos.com","password":"demo123"}'
```

Expected response:
```json
{
  "token": "eyJ...",
  "user": {
    "id": "...",
    "email": "demo@gastronomos.com",
    "role": "ADMIN",
    "tenant_id": "..."
  }
}
```

## Current Status

- ✅ Code fixed in repository
- ✅ Environment files updated
- ✅ Seed scripts created
- 🔄 **TODO**: Create demo account (run Step 1)
- 🔄 **TODO**: Redeploy frontend (run Step 3)

## Demo Credentials

Once created, use these credentials:
- **Email**: demo@gastronomos.com
- **Password**: demo123
- **Tenant**: Demo Restaurant

## Troubleshooting

### "Failed to fetch" or "Network error"
- Check if API is running: `curl https://api.gastronomos.clubemkt.digital/health`
- Verify API URL is correct in `.env` files

### "User already exists" (409 error)
- Good! The account already exists
- Try logging in directly

### "Invalid credentials"
- The account might not exist yet
- Run Step 1 to create it

### CORS error in browser
- The frontend URL needs to be in the CORS whitelist
- Check `src/index.ts` for allowed origins

## Quick Commands Reference

```bash
# Create demo account (Windows)
scripts\create-demo-account.bat

# Test API
curl https://api.gastronomos.clubemkt.digital/health

# Build frontend
cd gastronomos-frontend
npm run build

# Clean everything
npm run clean
```

---

**Priority**: 🔴 HIGH - User-facing issue  
**Impact**: Demo login not working  
**Time to fix**: ~5 minutes  
**Status**: Code ready, needs deployment
