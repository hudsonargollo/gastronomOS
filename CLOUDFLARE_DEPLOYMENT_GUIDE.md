# Pontal Stock - Cloudflare Deployment Guide

## Overview

This guide explains how to deploy the updated Pontal Stock system to Cloudflare using Workers (backend) and Pages (frontend), with all the latest features and Maraú Sunset design system applied.

## Prerequisites

- Cloudflare account with Workers and Pages enabled
- Wrangler CLI installed (`npm install -g wrangler`)
- Git repository with latest code
- Backend API URL (will be provided after deployment)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Cloudflare Edge                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐         ┌──────────────────┐    │
│  │  Workers        │         │  Pages           │    │
│  │  (Backend API)  │◄───────►│  (Frontend)      │    │
│  │                 │         │                  │    │
│  │ • Auth          │         │ • Pontal Stock   │    │
│  │ • Inventory     │         │ • Design System  │    │
│  │ • Payments      │         │ • Real-time UI   │    │
│  │ • Stock Alerts  │         │ • Multi-language │    │
│  │ • Analytics     │         │                  │    │
│  └──────────────────┘         └──────────────────┘    │
│         │                              │               │
│         └──────────────────────────────┘               │
│                    D1 Database                         │
│                  (SQLite)                              │
└─────────────────────────────────────────────────────────┘
```

## Backend Deployment (Workers)

### Step 1: Prepare Backend

```bash
# Install dependencies
npm install

# Build the backend
npm run build

# Test locally
wrangler dev
```

### Step 2: Deploy to Cloudflare Workers

```bash
# Deploy to production
wrangler deploy --env production

# Or deploy to staging
wrangler deploy --env staging
```

### Step 3: Verify Backend

```bash
# Check deployment
curl https://gastronomos.hudsonargollo2.workers.dev/

# Expected response:
# {
#   "message": "Pontal Stock API",
#   "version": "1.0.0",
#   "status": "operational",
#   "endpoints": { ... }
# }
```

## Frontend Deployment (Pages)

### Step 1: Build Frontend

```bash
cd gastronomos-frontend

# Install dependencies
npm install

# Build for production
npm run build
```

### Step 2: Deploy to Cloudflare Pages

#### Option A: Using Wrangler

```bash
# Deploy to Pages
wrangler pages deploy out/
```

#### Option B: Using GitHub Integration

1. Go to Cloudflare Dashboard
2. Navigate to Pages
3. Click "Create a project"
4. Select "Connect to Git"
5. Choose your GitHub repository
6. Configure build settings:
   - Framework: Next.js
   - Build command: `npm run build`
   - Build output directory: `out`
7. Click "Save and Deploy"

### Step 3: Configure Environment Variables

In Cloudflare Pages dashboard:

1. Go to Settings → Environment Variables
2. Add the following variables:

```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.hudsonargollo2.workers.dev
NEXT_PUBLIC_APP_NAME=Pontal Stock
NEXT_PUBLIC_APP_VERSION=1.0.0
```

### Step 4: Verify Frontend

Visit your Pages deployment URL and verify:
- ✅ Pontal Stock branding visible
- ✅ Maraú Sunset colors applied
- ✅ Login page loads correctly
- ✅ API calls to backend work

## Features Deployed

### Backend API Endpoints

```
Authentication
  POST   /api/v1/auth/login
  POST   /api/v1/auth/register
  POST   /api/v1/auth/logout
  POST   /api/v1/auth/refresh

Inventory Management
  GET    /api/v1/inventory
  POST   /api/v1/inventory
  PUT    /api/v1/inventory/:id
  DELETE /api/v1/inventory/:id

Purchase Orders
  GET    /api/v1/purchase-orders
  POST   /api/v1/purchase-orders
  PUT    /api/v1/purchase-orders/:id
  DELETE /api/v1/purchase-orders/:id

Payment Scheduling
  GET    /api/v1/payment-schedules
  POST   /api/v1/payment-schedules
  PUT    /api/v1/payment-schedules/:id
  DELETE /api/v1/payment-schedules/:id

Stock Alerts
  GET    /api/v1/stock-alert-configs
  POST   /api/v1/stock-alert-configs
  PUT    /api/v1/stock-alert-configs/:id
  DELETE /api/v1/stock-alert-configs/:id

Analytics & Dashboard
  GET    /api/v1/dashboard
  GET    /api/v1/dashboard/metrics
  GET    /api/v1/analytics/reports
```

### Frontend Features

- ✅ Multi-tenant stock management
- ✅ Purchase order management
- ✅ Payment scheduling with recurrence
- ✅ Stock alert system
- ✅ Analytics dashboard
- ✅ Real-time inventory tracking
- ✅ Multi-language support (Portuguese/English)
- ✅ Responsive design
- ✅ Maraú Sunset design system

## Design System

### Color Palette

```
Primary:      #2d5016 (Deep Forest Green)
Secondary:    #ea580c (Sunset Orange)
Accent:       #f4a460 (Sandy Brown)
Background:   #faf8f3 (Warm Sea Foam)
Surface:      #ffffff (Pure White)
Text:         #1c2912 (Dark Earth)
Text Secondary: #5a6b3d (Muted Olive)
```

### Typography

```
Headings:     Syne (premium, architectural feel)
Body:         JetBrains Mono (precision for inventory)
```

## Demo Credentials

```
Email:    demo@pontal-stock.com
Password: demo123
Tenant:   pontal-carapitangui
```

## Troubleshooting

### Backend Issues

**Issue**: API returns 500 error
- Check database connection in wrangler.toml
- Verify D1 database ID is correct
- Check environment variables are set

**Issue**: CORS errors
- Verify CORS configuration in src/middleware/auth.ts
- Check frontend URL is in allowed origins

### Frontend Issues

**Issue**: Blank page or 404
- Verify build output directory is `out`
- Check environment variables are set
- Clear Cloudflare cache

**Issue**: API calls fail
- Verify NEXT_PUBLIC_API_BASE_URL is set correctly
- Check backend is running and accessible
- Check browser console for specific errors

## Monitoring

### Backend Monitoring

1. Go to Cloudflare Dashboard
2. Select Workers
3. Click on "gastronomos" worker
4. View real-time logs and metrics

### Frontend Monitoring

1. Go to Cloudflare Dashboard
2. Select Pages
3. Click on your project
4. View analytics and performance metrics

## Custom Domain Setup

### For Backend

1. Go to Workers → gastronomos
2. Click "Triggers"
3. Add custom domain (e.g., api.pontal-stock.com)
4. Configure DNS records as instructed

### For Frontend

1. Go to Pages → Your Project
2. Click "Custom domains"
3. Add custom domain (e.g., pontal-stock.com)
4. Configure DNS records as instructed

## Performance Optimization

### Backend

- ✅ Caching enabled (TTL: 900s in production)
- ✅ Rate limiting enabled
- ✅ Database query optimization
- ✅ Compression enabled

### Frontend

- ✅ Static asset caching
- ✅ Image optimization
- ✅ Code splitting
- ✅ Minification enabled

## Security

- ✅ HTTPS/TLS enabled (automatic)
- ✅ JWT authentication
- ✅ Rate limiting
- ✅ CORS configured
- ✅ Input validation
- ✅ SQL injection prevention

## Backup & Recovery

### Database Backup

```bash
# Export database
wrangler d1 export gastronomos-prod > backup.sql

# Restore database
wrangler d1 execute gastronomos-prod < backup.sql
```

### Code Backup

- All code is in GitHub
- Automatic backups via Git
- Deployment history available in Cloudflare

## Rollback

### Backend Rollback

```bash
# View deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback
```

### Frontend Rollback

1. Go to Cloudflare Pages
2. Click "Deployments"
3. Select previous deployment
4. Click "Rollback"

## Support & Resources

- **Cloudflare Docs**: https://developers.cloudflare.com
- **Workers Docs**: https://developers.cloudflare.com/workers
- **Pages Docs**: https://developers.cloudflare.com/pages
- **D1 Docs**: https://developers.cloudflare.com/d1
- **GitHub**: https://github.com/hudsonargollo/gastronomOS

## Next Steps

1. Deploy backend to Workers
2. Deploy frontend to Pages
3. Configure environment variables
4. Set up custom domains
5. Monitor performance
6. Configure backups

---

**Last Updated**: April 20, 2026
**Status**: Ready for Cloudflare Deployment
**Version**: 1.0.0 (Pontal Stock)
