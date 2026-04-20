# Pontal Stock - Vercel Deployment Guide

## Overview

This guide explains how to deploy the Pontal Stock frontend to Vercel, the official Next.js hosting platform.

## Why Vercel?

- **Official Next.js Platform**: Built by the creators of Next.js
- **Full SSR Support**: Supports server-side rendering, API routes, and dynamic pages
- **Zero Configuration**: Automatic builds and deployments
- **Environment Variables**: Easy management of secrets and configuration
- **Custom Domains**: Support for custom domains with automatic SSL
- **Automatic Deployments**: Deploy on every push to your repository

## Prerequisites

- GitHub account with the repository
- Vercel account (free tier available)
- Backend API URL: `https://gastronomos.hudsonargollo2.workers.dev`

## Deployment Method 1: GitHub Integration (Recommended)

### Step 1: Connect GitHub Repository

1. Go to https://vercel.com/new
2. Click "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Select the repository containing the Pontal Stock project
5. Vercel will auto-detect the Next.js project in `gastronomos-frontend`

### Step 2: Configure Project Settings

1. **Project Name**: `pontal-stock-frontend` (or your preferred name)
2. **Framework Preset**: Next.js (should be auto-detected)
3. **Root Directory**: `gastronomos-frontend`
4. **Build Command**: `npm run build`
5. **Output Directory**: `.next`
6. **Install Command**: `npm install`

### Step 3: Set Environment Variables

1. Click "Environment Variables"
2. Add the following variables:

```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.hudsonargollo2.workers.dev
```

3. Click "Deploy"

### Step 4: Wait for Deployment

- Vercel will automatically build and deploy your app
- You'll see a deployment URL like `https://pontal-stock-frontend.vercel.app`
- The deployment is complete when you see the "Visit" button

## Deployment Method 2: Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This will open a browser window to authenticate with Vercel.

### Step 3: Deploy

```bash
cd gastronomos-frontend
vercel --prod
```

### Step 4: Configure Environment Variables

When prompted, configure the environment variables:

```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.hudsonargollo2.workers.dev
```

## Deployment Method 3: Manual Git Push

If you've connected your GitHub repository to Vercel:

1. Make changes to your code
2. Commit and push to your repository:

```bash
git add .
git commit -m "Deploy to Vercel"
git push origin main
```

3. Vercel will automatically detect the push and start a new deployment
4. Monitor the deployment in the Vercel dashboard

## Post-Deployment Configuration

### 1. Verify Deployment

1. Visit your deployment URL
2. Test the login page
3. Verify the "Pontal Stock" branding is visible
4. Test API calls to the backend

### 2. Configure Custom Domain (Optional)

1. Go to your Vercel project dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain (e.g., `pontal-stock.com`)
4. Follow the DNS configuration instructions
5. Wait for DNS propagation (can take up to 48 hours)

### 3. Set Up Production Environment Variables

1. Go to "Settings" → "Environment Variables"
2. Add any additional environment variables needed for production
3. Redeploy the application

### 4. Configure Analytics (Optional)

1. Go to "Analytics" in the Vercel dashboard
2. Enable Web Analytics to monitor performance
3. View real-time metrics and performance data

## Troubleshooting

### Issue: Build Fails

**Error**: `npm ERR! code ERESOLVE`

**Solution**:
1. Delete `package-lock.json` and `node_modules`
2. Run `npm install` locally
3. Commit and push the changes
4. Redeploy

### Issue: API Calls Fail

**Error**: `Failed to fetch from API`

**Solution**:
1. Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly in Vercel
2. Check that the backend API is running
3. Verify CORS is configured correctly on the backend
4. Check browser console for specific error messages

### Issue: Pages Show 404

**Error**: `404 - This page could not be found`

**Solution**:
1. Verify the build completed successfully
2. Check that all pages are in the correct directory structure
3. Verify the `next.config.js` is configured correctly
4. Redeploy the application

### Issue: Styles Not Loading

**Error**: CSS not applied, page looks unstyled

**Solution**:
1. Verify Tailwind CSS is configured correctly
2. Check that `tailwind.config.ts` exists
3. Verify `postcss.config.mjs` exists
4. Clear Vercel cache and redeploy:
   - Go to "Settings" → "Git"
   - Click "Clear Build Cache"
   - Redeploy

## Monitoring and Maintenance

### View Deployment Logs

1. Go to your Vercel project dashboard
2. Click "Deployments"
3. Select a deployment to view logs
4. Check "Build Logs" and "Runtime Logs"

### Monitor Performance

1. Go to "Analytics" in the Vercel dashboard
2. View real-time metrics:
   - Page load times
   - Error rates
   - Traffic patterns

### Automatic Deployments

- Every push to your main branch triggers a new deployment
- Preview deployments are created for pull requests
- Rollback to previous deployments with one click

## Environment Variables Reference

### Required Variables

```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.hudsonargollo2.workers.dev
```

### Optional Variables

```
NEXT_PUBLIC_APP_NAME=Pontal Stock
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Security Best Practices

1. **Never commit secrets**: Use Vercel environment variables for sensitive data
2. **Use HTTPS**: Vercel automatically provides SSL/TLS certificates
3. **Enable authentication**: Protect your deployment with password protection
4. **Monitor logs**: Regularly check deployment logs for errors
5. **Keep dependencies updated**: Regularly update npm packages

## Rollback to Previous Deployment

1. Go to your Vercel project dashboard
2. Click "Deployments"
3. Find the deployment you want to rollback to
4. Click the three dots menu
5. Select "Promote to Production"

## Support and Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Vercel Support**: https://vercel.com/support
- **Community**: https://github.com/vercel/next.js/discussions

## Summary

You now have a fully deployed Pontal Stock frontend on Vercel with:
- ✅ Automatic deployments on every push
- ✅ Full Next.js server-side rendering support
- ✅ Custom domain support
- ✅ Automatic SSL/TLS certificates
- ✅ Performance monitoring and analytics
- ✅ Easy rollback capabilities

For questions or issues, refer to the Vercel documentation or contact Vercel support.
