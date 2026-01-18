# GastronomOS Production Deployment Guide

This guide walks you through deploying GastronomOS to Cloudflare Workers with the custom domain `gastronomos.clubemkt.digital`.

## Prerequisites

1. **Cloudflare Account**: Ensure you have access to the Cloudflare account that manages `clubemkt.digital`
2. **Wrangler CLI**: Install and authenticate with Wrangler
3. **Domain Access**: Verify you can manage DNS for `clubemkt.digital`

## Step 1: Install and Authenticate Wrangler

```bash
# Install Wrangler globally
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

## Step 2: Create Production Database

```bash
# Create the production D1 database
wrangler d1 create gastronomos-prod

# Note the database ID from the output and update wrangler.toml
```

Update the `database_id` in `wrangler.toml` for the production environment:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "gastronomos-prod"
database_id = "YOUR_ACTUAL_DATABASE_ID_HERE"  # Replace with actual ID
migrations_dir = "migrations"
```

## Step 3: Create R2 Bucket for Receipt Storage

```bash
# Create production R2 bucket for receipt storage
wrangler r2 bucket create gastronomos-receipts-prod
```

## Step 4: Set Up Production Secrets

Generate and set the required secrets:

```bash
# Generate a secure JWT secret
npm run generate:jwt-secret

# Set the JWT secret (use the generated value)
wrangler secret put JWT_SECRET --env production

# Optional: Set admin API key for administrative operations
wrangler secret put ADMIN_API_KEY --env production
```

## Step 5: Run Database Migrations

```bash
# Apply all migrations to production database
npm run db:migrate:prod
```

## Step 6: Set Up Custom Domain

### Option A: Using Cloudflare Dashboard (Recommended)

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your `gastronomos` worker
3. Go to Settings → Triggers
4. Add Custom Domain: `gastronomos.clubemkt.digital`
5. Cloudflare will automatically handle SSL certificate

### Option B: Using Wrangler CLI

```bash
# Add custom domain via CLI
wrangler custom-domains add gastronomos.clubemkt.digital --env production
```

## Step 7: Deploy to Production

```bash
# Deploy to production environment
npm run deploy:prod
```

## Step 8: Verify Deployment

### Health Check
```bash
curl https://gastronomos.clubemkt.digital/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-17T...",
  "environment": "production"
}
```

### API Endpoint Check
```bash
curl https://gastronomos.clubemkt.digital/api/v1
```

Expected response:
```json
{
  "message": "GastronomOS Authentication API v1",
  "version": "1.0.0"
}
```

## Step 9: Monitor Deployment

```bash
# View real-time logs
wrangler tail --env production

# Check worker analytics in Cloudflare Dashboard
```

## DNS Configuration

If the custom domain doesn't work immediately, verify DNS settings:

1. Go to Cloudflare Dashboard → DNS → Records
2. Ensure there's a CNAME record for `gastronomos.clubemkt.digital` pointing to your worker
3. The record should be proxied (orange cloud icon)

## Security Checklist

- [ ] JWT_SECRET is set and secure (64+ characters)
- [ ] ADMIN_API_KEY is set (if using admin features)
- [ ] Database is in production environment
- [ ] R2 bucket has proper access controls
- [ ] Custom domain has valid SSL certificate
- [ ] Worker logs show no errors
- [ ] All API endpoints respond correctly

## Rollback Plan

If deployment issues occur:

```bash
# Check previous deployments
wrangler deployments list --env production

# Rollback to previous version if needed
wrangler rollback [DEPLOYMENT_ID] --env production
```

## Environment URLs

- **Production**: https://gastronomos.clubemkt.digital
- **Worker URL**: https://gastronomos.[your-subdomain].workers.dev (fallback)

## Monitoring and Maintenance

1. **Logs**: Monitor via `wrangler tail --env production`
2. **Analytics**: Check Cloudflare Dashboard → Analytics
3. **Alerts**: Set up alerts for error rates and response times
4. **Database**: Monitor D1 usage and performance
5. **R2 Storage**: Monitor receipt storage usage

## Troubleshooting

### Common Issues

1. **Custom Domain Not Working**
   - Check DNS propagation: `dig gastronomos.clubemkt.digital`
   - Verify domain is added in Cloudflare Workers dashboard
   - Ensure SSL certificate is active

2. **Database Connection Errors**
   - Verify database ID in wrangler.toml
   - Check if migrations were applied successfully
   - Ensure database exists in production environment

3. **Secret Access Issues**
   - Verify secrets are set: `wrangler secret list --env production`
   - Regenerate JWT secret if needed
   - Check secret names match code expectations

4. **R2 Bucket Access**
   - Verify bucket exists: `wrangler r2 bucket list`
   - Check bucket permissions and bindings
   - Ensure bucket name matches wrangler.toml

### Support Commands

```bash
# List all secrets
wrangler secret list --env production

# Check database status
wrangler d1 info gastronomos-prod

# List R2 buckets
wrangler r2 bucket list

# View deployment history
wrangler deployments list --env production
```

## Post-Deployment Tasks

1. **Create Initial Tenant**: Use the API to create your first tenant organization
2. **Set Up Admin User**: Create administrative users for system management
3. **Configure Monitoring**: Set up external monitoring for uptime and performance
4. **Backup Strategy**: Implement regular database backups
5. **Documentation**: Update API documentation with production URLs

## Success Criteria

✅ Worker deployed and accessible at custom domain  
✅ Database migrations applied successfully  
✅ All API endpoints responding correctly  
✅ Authentication system working  
✅ Receipt processing functional  
✅ Transfer system operational  
✅ Allocation system working  
✅ No errors in worker logs  
✅ SSL certificate active and valid  
✅ Monitoring and alerts configured  

Your GastronomOS system is now live at: **https://gastronomos.clubemkt.digital** 🚀