# Backend API Deployment Guide

## Current Issue

The frontend at `gastronomos.clubemkt.digital` cannot connect to the backend API because:
1. The API subdomain `api.gastronomos.clubemkt.digital` doesn't exist
2. The backend needs to be deployed to Cloudflare Workers
3. DNS needs to be configured to point to the Worker

## Solution Options

### Option 1: Deploy Backend to Cloudflare Workers (Recommended)

#### Step 1: Deploy the Worker

```bash
# Make sure you're in the root directory
cd /path/to/gastronomOS

# Deploy to production
npx wrangler deploy --env production

# Or deploy to staging first
npx wrangler deploy --env staging
```

#### Step 2: Configure Custom Domain

After deployment, configure the custom domain in Cloudflare:

1. Go to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Find your `gastronomos` worker
4. Go to Settings > Triggers
5. Add Custom Domain: `api.gastronomos.clubemkt.digital`
6. Cloudflare will automatically configure DNS

#### Step 3: Update Frontend Environment

The frontend `.env.production` is already configured to use:
```
NEXT_PUBLIC_API_BASE_URL=https://api.gastronomos.clubemkt.digital/api/v1
```

#### Step 4: Rebuild and Redeploy Frontend

```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

### Option 2: Use Worker's Default URL (Quick Fix)

If you don't want to configure a custom domain right now:

#### Step 1: Deploy the Worker

```bash
npx wrangler deploy --env production
```

This will give you a URL like: `https://gastronomos.YOUR-SUBDOMAIN.workers.dev`

#### Step 2: Update Frontend Environment

Update `gastronomos-frontend/.env.production`:
```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.YOUR-SUBDOMAIN.workers.dev/api/v1
```

#### Step 3: Rebuild and Redeploy Frontend

```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

### Option 3: Use Same Domain with Path (Alternative)

Deploy the backend to the same domain as the frontend:

#### Step 1: Configure Worker Route

In `wrangler.toml`, update the production routes:
```toml
[[env.production.routes]]
pattern = "gastronomos.clubemkt.digital/api/*"
zone_name = "clubemkt.digital"
```

#### Step 2: Deploy Worker

```bash
npx wrangler deploy --env production
```

#### Step 3: Update Frontend Environment

Update `gastronomos-frontend/.env.production`:
```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.clubemkt.digital/api/v1
```

#### Step 4: Rebuild and Redeploy Frontend

```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

## Pre-Deployment Checklist

Before deploying, make sure:

- [ ] JWT_SECRET is configured in Cloudflare Workers secrets
- [ ] D1 database is created and migrations are run
- [ ] Demo data is initialized
- [ ] CORS origins include the frontend domain
- [ ] Environment variables are set correctly

### Configure Secrets

```bash
# Set JWT secret for production
npx wrangler secret put JWT_SECRET --env production
# Enter a secure random string when prompted

# Verify secrets are set
npx wrangler secret list --env production
```

### Run Database Migrations

```bash
# Run migrations for production database
npx wrangler d1 migrations apply gastronomos-prod --env production
```

### Initialize Demo Data

After deployment, initialize demo data:

```bash
# Using the deployed API URL
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/demo/initialize

# Or using the worker's default URL
curl -X POST https://gastronomos.YOUR-SUBDOMAIN.workers.dev/api/v1/demo/initialize
```

## Verification Steps

After deployment, verify everything works:

### 1. Check API Health

```bash
curl https://api.gastronomos.clubemkt.digital/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-21T...",
  "environment": "production",
  "database": "connected",
  "jwt_configured": true
}
```

### 2. Check Demo Credentials

```bash
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/credentials
```

Expected response:
```json
{
  "success": true,
  "data": {
    "accounts": [...],
    "defaultAccount": {
      "email": "demo@gastronomos.com",
      "password": "demo123",
      ...
    }
  }
}
```

### 3. Test Authentication

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
    "id": "demo-user-id",
    "email": "demo@gastronomos.com",
    ...
  }
}
```

### 4. Test Frontend

1. Visit https://gastronomos.clubemkt.digital
2. Click "Try Demo" button
3. Credentials should load
4. Click "Sign In"
5. Dashboard should load with full content

## Troubleshooting

### Issue: "Could not resolve host"
- DNS not configured yet
- Wait a few minutes for DNS propagation
- Try using the worker's default URL instead

### Issue: "CORS error"
- Check that frontend domain is in CORS origins list
- Verify CORS middleware is configured correctly
- Check browser console for specific CORS error

### Issue: "JWT configuration error"
- JWT_SECRET not set in production
- Run: `npx wrangler secret put JWT_SECRET --env production`

### Issue: "Database connection error"
- D1 database not created
- Migrations not run
- Check database binding in wrangler.toml

### Issue: "Demo data not found"
- Demo data not initialized
- Run: `curl -X POST https://api.../api/v1/demo/initialize`

## Current Configuration

### Backend (wrangler.toml)
```toml
[env.production.vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
CACHE_TTL = "900"
JWT_EXPIRY = "28800"
BCRYPT_ROUNDS = "14"

[[env.production.routes]]
pattern = "api.gastronomos.clubemkt.digital/*"
zone_name = "clubemkt.digital"

[[env.production.d1_databases]]
binding = "DB"
database_name = "gastronomos-prod"
database_id = "253e34dc-9dfe-4a3b-8c2e-773f3294b15d"
```

### Frontend (.env.production)
```
NEXT_PUBLIC_API_BASE_URL=https://api.gastronomos.clubemkt.digital/api/v1
```

## Next Steps

1. **Deploy the backend** using one of the options above
2. **Configure DNS/Custom Domain** if using Option 1
3. **Initialize demo data** after backend is deployed
4. **Rebuild and redeploy frontend** with correct API URL
5. **Test the complete flow** from login to dashboard

## Support

If you encounter issues:
1. Check Cloudflare Workers logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test API endpoints individually
5. Check CORS configuration
