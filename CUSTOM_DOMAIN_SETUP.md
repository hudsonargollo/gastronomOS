# Custom Domain Setup Guide

## Current Status

Your custom domain `gastronomos.clubemkt.digital` is configured but needs proper secrets set up.

## Backend (Cloudflare Workers) - api.gastronomos.clubemkt.digital

### 1. Set Production Secrets

The JWT_SECRET needs to be set as a secret (not in wrangler.toml for security):

```bash
# Set JWT secret for production
npx wrangler secret put JWT_SECRET --env production
# When prompted, enter a strong secret (at least 32 characters)
# Example: openssl rand -base64 32
```

### 2. Deploy to Production Environment

```bash
# Deploy to production with custom domain
npx wrangler deploy --env production
```

### 3. Verify DNS Settings

Make sure these DNS records are set in Cloudflare DNS for `clubemkt.digital`:

**For Backend API:**
- Type: `CNAME`
- Name: `api.gastronomos` (or `api.gastronomos.clubemkt.digital`)
- Target: `gastronomos.hudsonargollo2.workers.dev`
- Proxy: ✅ Proxied (Orange cloud)

## Frontend (Cloudflare Pages) - gastronomos.clubemkt.digital

### 1. Add Custom Domain to Cloudflare Pages

```bash
# Add custom domain to Pages project
npx wrangler pages deployment create gastronomos-frontend \
  --project-name=gastronomos-frontend \
  --branch=main
```

Or via Cloudflare Dashboard:
1. Go to Cloudflare Pages
2. Select `gastronomos-frontend` project
3. Go to "Custom domains"
4. Click "Set up a custom domain"
5. Enter: `gastronomos.clubemkt.digital`
6. Cloudflare will automatically configure DNS

### 2. Verify DNS Settings

**For Frontend:**
- Type: `CNAME`
- Name: `gastronomos` (or `gastronomos.clubemkt.digital`)
- Target: `gastronomos-frontend.pages.dev`
- Proxy: ✅ Proxied (Orange cloud)

## Quick Setup Commands

### Generate Strong JWT Secret
```bash
# Generate a secure random secret
openssl rand -base64 32
```

### Set All Production Secrets
```bash
# JWT Secret (required)
npx wrangler secret put JWT_SECRET --env production

# Optional: Set other secrets if needed
npx wrangler secret put DATABASE_URL --env production
```

### Deploy Backend to Production
```bash
npx wrangler deploy --env production
```

### Deploy Frontend with Custom Domain
```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

## Verify Deployment

### Test Backend API
```bash
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/credentials
```

### Test Frontend
```bash
curl -I https://gastronomos.clubemkt.digital
```

## Update Frontend API URL

After custom domain is set up, update the frontend to use the custom domain:

**File**: `gastronomos-frontend/.env.production`
```env
NEXT_PUBLIC_API_URL=https://api.gastronomos.clubemkt.digital/api/v1
```

Then rebuild and redeploy:
```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

## Troubleshooting

### "JWT service configuration is invalid"
- **Cause**: JWT_SECRET not set in production environment
- **Fix**: Run `npx wrangler secret put JWT_SECRET --env production`

### "DNS_PROBE_FINISHED_NXDOMAIN"
- **Cause**: DNS records not configured
- **Fix**: Add CNAME records in Cloudflare DNS as described above

### "Too many redirects"
- **Cause**: SSL/TLS mode incorrect
- **Fix**: Set SSL/TLS to "Full" or "Full (strict)" in Cloudflare

### Custom domain not working
- **Cause**: Domain not added to Pages project
- **Fix**: Add custom domain in Cloudflare Pages dashboard

## Current URLs

### Development (No Custom Domain)
- **Frontend**: https://5f738bd1.gastronomos-frontend.pages.dev
- **Backend**: https://gastronomos.hudsonargollo2.workers.dev

### Production (With Custom Domain)
- **Frontend**: https://gastronomos.clubemkt.digital (to be configured)
- **Backend**: https://api.gastronomos.clubemkt.digital (needs JWT_SECRET)

## Next Steps

1. ✅ Generate JWT secret: `openssl rand -base64 32`
2. ⏳ Set production secret: `npx wrangler secret put JWT_SECRET --env production`
3. ⏳ Deploy to production: `npx wrangler deploy --env production`
4. ⏳ Configure DNS records in Cloudflare
5. ⏳ Add custom domain to Pages project
6. ⏳ Update frontend .env.production
7. ⏳ Rebuild and redeploy frontend

---

**Note**: Make sure you're logged into the correct Cloudflare account that owns the `clubemkt.digital` domain.
