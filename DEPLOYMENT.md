# GastronomOS Authentication Service - Deployment Guide

This guide covers deploying the Multi-Tenant Authentication & Authorization system to Cloudflare Workers across different environments.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers enabled
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Authentication**: Login to Wrangler with `wrangler login`
4. **Node.js**: Version 18+ required for development

## Environment Setup

The system supports three environments:
- **Development**: For local development and testing
- **Staging**: For pre-production testing
- **Production**: For live deployment

### 1. Database Setup

Create D1 databases for each environment:

```bash
# Development
wrangler d1 create gastronomos-auth-dev

# Staging  
wrangler d1 create gastronomos-auth-staging

# Production
wrangler d1 create gastronomos-auth-prod
```

Update `wrangler.toml` with the database IDs returned from the commands above.

### 2. Secret Configuration

Each environment requires specific secrets to be configured:

#### Required Secrets

**JWT_SECRET** - Cryptographic key for JWT token signing
```bash
# Generate a secure secret (64+ characters for production)
npm run generate:jwt-secret

# Set for each environment
wrangler secret put JWT_SECRET --env development
wrangler secret put JWT_SECRET --env staging
wrangler secret put JWT_SECRET --env production
```

#### Optional Secrets

**ADMIN_API_KEY** - API key for administrative operations
```bash
wrangler secret put ADMIN_API_KEY --env development
wrangler secret put ADMIN_API_KEY --env staging
wrangler secret put ADMIN_API_KEY --env production
```

**DATABASE_ENCRYPTION_KEY** - Additional encryption for sensitive audit data
```bash
wrangler secret put DATABASE_ENCRYPTION_KEY --env staging
wrangler secret put DATABASE_ENCRYPTION_KEY --env production
```

### 3. View Secret Setup Instructions

Get environment-specific secret setup instructions:

```bash
npm run secrets:dev      # Development environment
npm run secrets:staging  # Staging environment
npm run secrets:prod     # Production environment
```

## Deployment Process

### Automated Deployment

Use the provided deployment scripts for a complete deployment process:

```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

The deployment script will:
1. ✅ Check prerequisites (Wrangler CLI, authentication)
2. ✅ Build TypeScript code
3. ✅ Verify secrets are configured
4. ✅ Run database migrations
5. ✅ Deploy the Worker
6. ✅ Run post-deployment health checks

### Manual Deployment

If you prefer manual deployment:

```bash
# 1. Build the project
npm run build

# 2. Run database migrations
npm run db:migrate:dev      # or staging/prod
npm run db:migrate:staging
npm run db:migrate:prod

# 3. Deploy the Worker
wrangler deploy --env development  # or staging/production
wrangler deploy --env staging
wrangler deploy --env production
```

## Environment Configuration

### Development Environment
- **Purpose**: Local development and testing
- **JWT Expiry**: 24 hours
- **Bcrypt Rounds**: 10 (faster for development)
- **Cache**: Disabled for easier debugging
- **Rate Limiting**: Disabled
- **Log Level**: Debug

### Staging Environment
- **Purpose**: Pre-production testing
- **JWT Expiry**: 12 hours
- **Bcrypt Rounds**: 12 (production-level security)
- **Cache**: Enabled (10 minutes TTL)
- **Rate Limiting**: Enabled
- **Log Level**: Info

### Production Environment
- **Purpose**: Live deployment
- **JWT Expiry**: 8 hours (enhanced security)
- **Bcrypt Rounds**: 14 (high security)
- **Cache**: Enabled (15 minutes TTL)
- **Rate Limiting**: Enabled
- **Log Level**: Warn
- **Audit Retention**: 90 days

## Database Management

### Running Migrations

Migrations are automatically run during deployment, but you can run them manually:

```bash
# Development
npm run db:migrate:dev

# Staging
npm run db:migrate:staging

# Production
npm run db:migrate:prod
```

### Database Console Access

Access the database console for debugging:

```bash
# Development
wrangler d1 execute gastronomos-auth-dev --command "SELECT COUNT(*) FROM tenants" --env development

# Staging
wrangler d1 execute gastronomos-auth-staging --command "SELECT COUNT(*) FROM tenants" --env staging

# Production (use with caution)
wrangler d1 execute gastronomos-auth-prod --command "SELECT COUNT(*) FROM tenants" --env production
```

## Monitoring and Debugging

### View Worker Logs

Monitor real-time logs from your deployed Worker:

```bash
# Development
wrangler tail --env development

# Staging
wrangler tail --env staging

# Production
wrangler tail --env production
```

### Health Check Endpoints

After deployment, verify the service is working:

```bash
# Check service health
curl https://your-worker-url.workers.dev/health

# Check database connectivity
curl https://your-worker-url.workers.dev/health/db
```

## Security Considerations

### Production Security Checklist

- [ ] JWT_SECRET is at least 64 characters and cryptographically secure
- [ ] Different secrets used for each environment
- [ ] ADMIN_API_KEY is set and secure
- [ ] Database encryption key is configured
- [ ] Rate limiting is enabled
- [ ] Audit logging is configured with appropriate retention
- [ ] HTTPS is enforced (automatic with Cloudflare Workers)
- [ ] CORS origins are properly configured

### Secret Management Best Practices

1. **Never commit secrets to version control**
2. **Use different secrets for each environment**
3. **Rotate secrets regularly (quarterly recommended)**
4. **Store secrets securely in a password manager**
5. **Limit access to production secrets**

## Custom Domain Configuration

For production deployments, configure custom domains in `wrangler.toml`:

```toml
[env.production]
routes = [
  { pattern = "auth.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```

## Troubleshooting

### Common Issues

**"JWT_SECRET is required in production environment"**
- Solution: Set the JWT_SECRET using `wrangler secret put JWT_SECRET --env production`

**"Database not found"**
- Solution: Ensure D1 database is created and database_id is correct in wrangler.toml

**"Migration failed"**
- Solution: Check database permissions and ensure migrations directory exists

**"Build failed"**
- Solution: Run `npm run build` locally to check for TypeScript errors

### Getting Help

1. Check Worker logs: `wrangler tail --env <environment>`
2. Verify configuration: Review wrangler.toml settings
3. Test locally: Use `wrangler dev` for local testing
4. Check secrets: Ensure all required secrets are set

## Performance Optimization

The system includes several performance optimizations:

### Database Indexes
- Composite indexes for tenant-scoped queries
- Optimized indexes for common query patterns
- Audit log indexes for time-based queries

### Caching
- In-memory caching for frequently accessed data
- Configurable TTL per environment
- Automatic cache invalidation on data changes

### Query Optimization
- Tenant-scoped query patterns
- Efficient pagination
- Optimized audit log queries

## Rollback Procedure

If you need to rollback a deployment:

1. **Identify the previous version**:
   ```bash
   wrangler deployments list --env production
   ```

2. **Rollback to previous version**:
   ```bash
   wrangler rollback --env production
   ```

3. **Verify rollback**:
   ```bash
   curl https://your-worker-url.workers.dev/health
   ```

## Maintenance

### Regular Maintenance Tasks

1. **Monitor audit logs** for security events
2. **Review performance metrics** in Cloudflare dashboard
3. **Update dependencies** regularly
4. **Rotate secrets** quarterly
5. **Review and update rate limits** based on usage patterns

### Backup Strategy

- D1 databases are automatically backed up by Cloudflare
- Export critical configuration and secrets to secure storage
- Document custom domain and routing configurations

## Support

For deployment issues or questions:

1. Check the troubleshooting section above
2. Review Cloudflare Workers documentation
3. Check project issues on GitHub
4. Contact the development team

---

**Security Note**: This deployment guide contains sensitive configuration information. Ensure it's stored securely and access is limited to authorized personnel only.