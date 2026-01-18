# 🚀 GastronomOS Production Deployment Checklist

## Pre-Deployment Setup

### 1. Cloudflare Account Setup
- [ ] Access to Cloudflare account managing `clubemkt.digital`
- [ ] Wrangler CLI installed: `npm install -g wrangler`
- [ ] Authenticated with Cloudflare: `wrangler login`

### 2. Create Production Resources

#### D1 Database
```bash
wrangler d1 create gastronomos-prod
```
- [ ] Database created
- [ ] Database ID copied to `wrangler.toml` (replace `your-production-database-id-here`)

#### R2 Bucket
```bash
wrangler r2 bucket create gastronomos-receipts-prod
```
- [ ] R2 bucket created for receipt storage

### 3. Set Production Secrets

#### Generate JWT Secret
```bash
npm run generate:jwt-secret
```

#### Set Secrets
```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put ADMIN_API_KEY --env production  # Optional
```
- [ ] JWT_SECRET set (use generated 64+ character string)
- [ ] ADMIN_API_KEY set (optional, for admin operations)

## Deployment Process

### Option A: Automated Deployment (Recommended)
```bash
npm run deploy:prod:auto
```

### Option B: Manual Step-by-Step
```bash
# 1. Build the project
npm run build

# 2. Run database migrations
npm run db:migrate:prod

# 3. Deploy to production
npm run deploy:prod
```

## Custom Domain Setup

### Method 1: Cloudflare Dashboard (Recommended)
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages**
3. Select **gastronomos** worker
4. Go to **Settings** → **Triggers**
5. Click **Add Custom Domain**
6. Enter: `gastronomos.clubemkt.digital`
7. Click **Add Custom Domain**

### Method 2: Wrangler CLI
```bash
wrangler custom-domains add gastronomos.clubemkt.digital --env production
```

- [ ] Custom domain added and SSL certificate active

## Post-Deployment Verification

### 1. Health Check
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
- [ ] Health endpoint responding

### 2. API Check
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
- [ ] API endpoint responding

### 3. System Components Check
Test key endpoints:
- [ ] `GET /health` - System health
- [ ] `GET /api/v1` - API info
- [ ] `POST /auth/register` - User registration (with test data)
- [ ] `POST /auth/login` - User authentication (with test credentials)

## Monitoring Setup

### 1. Cloudflare Analytics
- [ ] Check **Workers & Pages** → **gastronomos** → **Analytics**
- [ ] Verify requests are being processed
- [ ] Check error rates and response times

### 2. Real-time Logs
```bash
wrangler tail --env production
```
- [ ] Logs showing successful requests
- [ ] No error messages in logs

### 3. Database Verification
```bash
wrangler d1 execute gastronomos-prod --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'" --env production
```
- [ ] Database tables created successfully
- [ ] Migrations applied correctly

## Security Verification

### 1. Secrets Check
```bash
wrangler secret list --env production
```
- [ ] JWT_SECRET is set
- [ ] No secrets exposed in logs
- [ ] Environment variables properly configured

### 2. SSL/TLS Check
- [ ] Custom domain has valid SSL certificate
- [ ] HTTPS redirects working
- [ ] No mixed content warnings

### 3. CORS Configuration
- [ ] CORS headers properly configured
- [ ] Only allowed origins can access API
- [ ] Preflight requests handled correctly

## Performance Verification

### 1. Response Times
- [ ] Health endpoint < 100ms
- [ ] API endpoints < 500ms
- [ ] Database queries optimized

### 2. Resource Usage
- [ ] Worker CPU usage within limits
- [ ] Memory usage acceptable
- [ ] D1 database performance good

## Final Production Checklist

### System Status
- [ ] ✅ Worker deployed and accessible
- [ ] ✅ Custom domain working with SSL
- [ ] ✅ Database migrations applied
- [ ] ✅ All secrets configured
- [ ] ✅ R2 bucket accessible
- [ ] ✅ Health checks passing
- [ ] ✅ API endpoints responding
- [ ] ✅ Logs showing no errors
- [ ] ✅ Analytics tracking requests

### Business Readiness
- [ ] 📋 Create initial tenant organization
- [ ] 👤 Set up admin user accounts
- [ ] 📊 Configure monitoring alerts
- [ ] 📖 Update documentation with production URLs
- [ ] 🔄 Set up backup procedures
- [ ] 📞 Prepare support procedures

## Rollback Plan (If Needed)

### Quick Rollback
```bash
# List recent deployments
wrangler deployments list --env production

# Rollback to previous version
wrangler rollback [DEPLOYMENT_ID] --env production
```

### Emergency Contacts
- Cloudflare Support: [support.cloudflare.com](https://support.cloudflare.com)
- DNS Issues: Check Cloudflare DNS settings
- Worker Issues: Check Cloudflare Workers dashboard

## Success! 🎉

Your GastronomOS system is now live at:
**https://gastronomos.clubemkt.digital**

### Next Steps:
1. **Create Your First Tenant**: Use the registration API
2. **Set Up Admin Users**: Create administrative accounts
3. **Configure Monitoring**: Set up uptime monitoring
4. **Load Testing**: Test with expected traffic
5. **Documentation**: Update team documentation
6. **Training**: Train users on the new system

---

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Version**: 1.0.0  
**Environment**: Production  
**Domain**: gastronomos.clubemkt.digital  