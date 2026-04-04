# Deployment Guide

This guide covers deployment procedures for the GastronomOS Digital Menu, Kitchen Orchestration & Payment System.

## Architecture

The system deploys to **Cloudflare Workers** with the following components:
- **Backend API**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite)
- **Real-time**: Cloudflare Durable Objects (WebSocket)
- **Storage**: Cloudflare R2 (receipt images)
- **Frontend**: Next.js on Vercel/Netlify

## Prerequisites

1. Cloudflare account with Workers enabled
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Node.js 20.x
4. Access to Cloudflare D1, R2, and Durable Objects

## Environment Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create D1 Databases

```bash
# Development
wrangler d1 create gastronomos-dev

# Staging
wrangler d1 create gastronomos-staging

# Production
wrangler d1 create gastronomos-prod
```

Update the database IDs in `wrangler.toml`.

### 4. Set Secrets

```bash
# Development
wrangler secret put JWT_SECRET --env development
wrangler secret put PAYMENT_ENCRYPTION_KEY --env development
wrangler secret put MERCADO_PAGO_ACCESS_TOKEN --env development

# Staging
wrangler secret put JWT_SECRET --env staging
wrangler secret put PAYMENT_ENCRYPTION_KEY --env staging
wrangler secret put MERCADO_PAGO_ACCESS_TOKEN --env staging

# Production
wrangler secret put JWT_SECRET --env production
wrangler secret put PAYMENT_ENCRYPTION_KEY --env production
wrangler secret put MERCADO_PAGO_ACCESS_TOKEN --env production
```

## Deployment Procedures

### Development Deployment

```bash
# Run database migrations
npm run db:migrate:dev

# Deploy to development
npm run deploy:dev
```

### Staging Deployment

```bash
# Run database migrations
npm run db:migrate:staging

# Deploy to staging
npm run deploy:staging
```

### Production Deployment

```bash
# Run database migrations
npm run db:migrate:prod

# Deploy to production
npm run deploy:prod
```

## CI/CD Pipeline

The project uses GitHub Actions for automated deployment:

- **develop** branch → Deploys to development environment
- **staging** branch → Deploys to staging environment
- **main** branch → Deploys to production environment

### Required GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `JWT_SECRET_DEV`
- `JWT_SECRET_STAGING`
- `JWT_SECRET_PRODUCTION`
- `PAYMENT_ENCRYPTION_KEY`
- `MERCADO_PAGO_ACCESS_TOKEN`

## Database Migrations

### Generate Migration

```bash
npm run db:generate
```

### Apply Migrations

```bash
# Local
npm run db:migrate:local

# Development
npm run db:migrate:dev

# Staging
npm run db:migrate:staging

# Production
npm run db:migrate:prod
```

## Local Development

### Using Wrangler Dev

```bash
npm run dev
```

### Using Docker Compose

```bash
docker-compose up -d
```

This starts:
- API server on port 8787
- Redis on port 6379
- Redis Commander on port 8081
- Frontend on port 3000

## Health Checks

### API Health

```bash
curl https://api.gastronomos.clubemkt.digital/health
```

### Database Health

```bash
wrangler d1 execute gastronomos-prod --env production --command "SELECT 1"
```

## Monitoring

### Cloudflare Dashboard

- Workers logs: https://dash.cloudflare.com → Workers → gastronomos
- D1 metrics: https://dash.cloudflare.com → D1 → gastronomos-prod
- Analytics: https://dash.cloudflare.com → Analytics

### System Health Endpoint

```bash
curl https://api.gastronomos.clubemkt.digital/api/health
```

Returns:
- Service status
- Database connectivity
- Cache status
- Dependencies health

## Rollback Procedure

### Code Rollback

```bash
# List deployments
wrangler deployments list --env production

# Rollback to previous version
wrangler rollback --env production
```

### Database Rollback

```bash
# Apply rollback migration
wrangler d1 execute gastronomos-prod --env production --file migrations/rollback_xxx.sql
```

## Troubleshooting

### Common Issues

1. **JWT_SECRET not set**
   - Ensure secret is set via `wrangler secret put JWT_SECRET --env <environment>`

2. **Database migration failed**
   - Check migration SQL syntax
   - Verify D1 database exists
   - Check for conflicting migrations

3. **Worker deployment failed**
   - Check wrangler authentication
   - Verify account permissions
   - Check for syntax errors in code

4. **WebSocket connection failed**
   - Verify Durable Objects are enabled
   - Check WEBSOCKET_DO binding in wrangler.toml

### Logs

```bash
# Tail production logs
wrangler tail --env production

# Tail development logs
wrangler tail --env development
```

## Security Checklist

- [ ] JWT_SECRET is at least 64 characters in production
- [ ] All secrets are set via Cloudflare (not in code)
- [ ] BCRYPT_ROUNDS is at least 14 in production
- [ ] Rate limiting is enabled in production
- [ ] CORS is configured for production domain only
- [ ] Payment credentials are encrypted
- [ ] Audit logging is enabled