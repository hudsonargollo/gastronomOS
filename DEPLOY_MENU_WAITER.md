# Deployment Guide: Menu Manager & Waiter Panel

## Prerequisites

- Node.js 18+ installed
- Git repository set up
- Cloudflare account with Pages and Workers
- Environment variables configured

## Step 1: Update Environment Variables

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=https://gastronomos.hudsonargollo2.workers.dev
```

### Backend (wrangler.toml)
Already configured - no changes needed

## Step 2: Build Frontend

```bash
cd gastronomos-frontend

# Install dependencies
npm install

# Build for production
npm run build

# Test build locally
npm run start
```

## Step 3: Deploy Frontend to Cloudflare Pages

### Option A: Using Git (Recommended)

1. Push code to GitHub:
```bash
git add .
git commit -m "Add menu manager and waiter panel"
git push origin main
```

2. Cloudflare Pages will auto-deploy on push

### Option B: Manual Deployment

```bash
# Install Wrangler CLI
npm install -g wrangler

# Deploy
wrangler pages deploy out/
```

## Step 4: Verify Deployment

### Check Frontend
```bash
# Visit the deployed site
https://gastronomos-frontend.pages.dev

# Check specific pages
https://gastronomos-frontend.pages.dev/inventory/products
https://gastronomos-frontend.pages.dev/waiter-panel
```

### Check Backend
```bash
# Test API endpoint
curl https://gastronomos.hudsonargollo2.workers.dev/menu \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Step 5: Test Functionality

### Test Menu Manager

1. Login to frontend
2. Navigate to `/inventory/products`
3. Create a test menu item:
   ```
   Name: "Test Pasta"
   Price: "25.00"
   Description: "Test item"
   Prep Time: "15"
   ```
4. Verify item appears in list
5. Edit item (change price to 30.00)
6. Verify update works
7. Toggle availability
8. Delete item

### Test Waiter Panel

1. Create test order via API:
```bash
curl -X POST https://gastronomos.hudsonargollo2.workers.dev/orders \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "locationId": "test-location",
    "tableNumber": "5",
    "items": [
      {
        "menuItemId": "test-item-id",
        "quantity": 2
      }
    ]
  }'
```

2. Navigate to `/waiter-panel`
3. Verify order appears in list
4. Click order to see details
5. Change status to PREPARING
6. Change status to READY
7. Change status to DELIVERED
8. Verify commission updates

## Step 6: Monitor Deployment

### Frontend Monitoring
- Check Cloudflare Pages dashboard
- View build logs
- Monitor performance metrics

### Backend Monitoring
- Check Cloudflare Workers dashboard
- View real-time logs
- Monitor error rates

## Step 7: Rollback (if needed)

### Frontend Rollback
```bash
# Cloudflare Pages automatically keeps previous deployments
# Go to Pages dashboard → Deployments → Select previous version
```

### Backend Rollback
```bash
# Redeploy previous version
wrangler deploy --env production
```

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### API Not Responding
- Check Cloudflare Workers dashboard for errors
- Verify JWT_SECRET is set
- Check database connection

### CORS Issues
- Verify API_URL is correct
- Check CORS headers in backend
- Clear browser cache

### Authentication Fails
- Verify JWT token is valid
- Check token expiration
- Re-login to get new token

## Performance Optimization

### Frontend
```bash
# Enable compression
# Already configured in next.config.ts

# Optimize images
# Use next/image component

# Code splitting
# Automatic with Next.js
```

### Backend
```bash
# Database optimization
# Indexes already created

# Connection pooling
# Configured in D1

# Caching
# Add Cache-Control headers
```

## Security Checklist

- [ ] JWT_SECRET is set in Cloudflare Workers
- [ ] HTTPS is enabled (automatic with Cloudflare)
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Input validation is in place
- [ ] SQL injection prevention (using Drizzle ORM)
- [ ] XSS prevention (React escapes by default)
- [ ] CSRF protection (if needed)

## Monitoring & Alerts

### Set Up Alerts
1. Go to Cloudflare dashboard
2. Set up error rate alerts
3. Set up performance alerts
4. Configure email notifications

### Monitor Metrics
- Error rate
- Response time
- Request volume
- Database performance

## Maintenance

### Regular Tasks
- [ ] Review error logs weekly
- [ ] Monitor performance metrics
- [ ] Update dependencies monthly
- [ ] Backup database regularly
- [ ] Review security logs

### Scheduled Maintenance
- Database optimization: Monthly
- Log cleanup: Monthly
- Security updates: As needed
- Feature updates: As planned

## Scaling

### When to Scale
- Error rate > 1%
- Response time > 1 second
- Database CPU > 80%
- Memory usage > 80%

### Scaling Options
1. **Horizontal Scaling**
   - Add more Workers instances
   - Cloudflare handles automatically

2. **Vertical Scaling**
   - Upgrade database tier
   - Increase memory/CPU

3. **Caching**
   - Add Redis cache layer
   - Cache API responses

## Disaster Recovery

### Backup Strategy
- Database backups: Daily
- Code backups: Git repository
- Configuration backups: Documented

### Recovery Procedures
1. **Database Failure**
   - Restore from latest backup
   - Verify data integrity
   - Test functionality

2. **Code Failure**
   - Rollback to previous version
   - Verify deployment
   - Monitor for issues

3. **Complete Outage**
   - Check Cloudflare status
   - Verify DNS settings
   - Contact Cloudflare support

## Post-Deployment Checklist

- [ ] Frontend loads without errors
- [ ] Menu manager works (create/edit/delete)
- [ ] Waiter panel shows orders
- [ ] API endpoints respond correctly
- [ ] Authentication works
- [ ] Database queries are fast
- [ ] Error handling works
- [ ] Notifications display correctly
- [ ] Mobile responsive
- [ ] Performance acceptable

## Support

### Getting Help
1. Check error logs
2. Review documentation
3. Test with curl/Postman
4. Check Cloudflare status
5. Contact support

### Useful Links
- Cloudflare Dashboard: https://dash.cloudflare.com
- Workers Documentation: https://developers.cloudflare.com/workers/
- Pages Documentation: https://developers.cloudflare.com/pages/
- D1 Documentation: https://developers.cloudflare.com/d1/

## Next Steps

1. **Monitor deployment** for 24 hours
2. **Gather user feedback** on new features
3. **Optimize performance** based on metrics
4. **Plan next features** based on requirements
5. **Schedule maintenance** window if needed

## Conclusion

Your menu manager and waiter panel are now deployed and ready for production use. Monitor the system closely and make adjustments as needed based on user feedback and performance metrics.
