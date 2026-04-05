# Deployment Guide

## Prerequisites

- Wrangler CLI installed: `npm install -g wrangler`
- Cloudflare account with Workers and Pages enabled
- D1 database created in Cloudflare

## Environment Setup

### 1. Configure Wrangler

Ensure `wrangler.toml` and `wrangler-frontend.toml` are properly configured with:
- Account ID
- Zone ID (for custom domains)
- Database bindings
- Environment variables

### 2. Set Environment Variables

Create `.env.production` with production values:
```
ENVIRONMENT=production
LOG_LEVEL=warn
CACHE_TTL=900
JWT_EXPIRY=28800
BCRYPT_ROUNDS=14
RATE_LIMIT_ENABLED=true
AUDIT_LOG_RETENTION_DAYS=90
```

## Backend Deployment

### Build
```bash
npm run build
```

### Deploy to Production
```bash
wrangler deploy --config wrangler.toml --env production
```

### Verify Deployment
```bash
curl https://api.gastronomos.clubemkt.digital/health
```

## Frontend Deployment

### Build
```bash
cd gastronomos-frontend
npm run build
cd ..
```

### Deploy to Wrangler
```bash
wrangler deploy --config wrangler-frontend.toml
```

### Verify Deployment
Visit: https://gastronomos.clubemkt.digital

## Database Migrations

### Apply Migrations
```bash
npm run db:migrate
```

### Rollback (if needed)
```bash
npm run db:rollback
```

## Monitoring

### Check Worker Status
```bash
wrangler tail --config wrangler.toml --env production
```

### View Logs
Logs are available in Cloudflare Dashboard → Workers → Logs

## Troubleshooting

### Build Failures
1. Clear cache: `rm -rf .next dist node_modules`
2. Reinstall: `npm install`
3. Rebuild: `npm run build`

### Deployment Issues
1. Check Wrangler config
2. Verify environment variables
3. Check Cloudflare account permissions
4. Review error logs in Cloudflare Dashboard

### Database Issues
1. Verify D1 database exists
2. Check database bindings in wrangler.toml
3. Run migrations: `npm run db:migrate`

## Rollback

To rollback to a previous version:

```bash
# List recent deployments
wrangler deployments list --config wrangler.toml --env production

# Rollback to specific version
wrangler rollback --config wrangler.toml --env production
```

## Performance Optimization

### Caching
- Set `CACHE_TTL` appropriately (default: 900s)
- Use Cloudflare Cache Rules for static assets

### Database
- Monitor D1 query performance
- Use indexes for frequently queried columns
- Archive old audit logs

### Frontend
- Enable image optimization
- Use code splitting
- Minify assets

## Security Checklist

- [ ] Environment variables are set correctly
- [ ] JWT secrets are strong and unique
- [ ] Database backups are configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] SSL/TLS is enabled
- [ ] Audit logging is active
- [ ] Regular security updates applied

## Maintenance

### Regular Tasks
- Monitor error logs
- Review performance metrics
- Update dependencies
- Backup database
- Review audit logs

### Monthly
- Security audit
- Performance review
- Dependency updates
- Database optimization

## Support

For deployment issues, check:
1. Cloudflare Dashboard
2. Wrangler logs
3. Application error logs
4. Database status
