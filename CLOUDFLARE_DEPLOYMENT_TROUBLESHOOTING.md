# Cloudflare Deployment - Troubleshooting & Access Guide

## Current Status

Your Pontal Stock frontend has been successfully deployed to Cloudflare Pages. However, the SSL error you're seeing is due to accessing a temporary preview URL.

## Deployment URLs

### Temporary Preview URL (with SSL issue)
- **URL**: https://30911c8a.pontal-stock-frontend.pages.dev
- **Status**: ⚠️ Temporary preview URL (may have SSL issues)
- **Note**: This is a temporary deployment URL that may not have proper SSL certificates

### Production URL (Recommended)
- **URL**: https://pontal-stock-frontend.pages.dev
- **Status**: ⏳ Needs custom domain or project configuration
- **Note**: This is the main project domain

## Solution: Set Up Custom Domain

To fix the SSL error and get a proper production URL, you need to set up a custom domain:

### Option 1: Use Cloudflare-Managed Domain (Recommended)

1. **Go to Cloudflare Dashboard**
   - https://dash.cloudflare.com

2. **Navigate to Pages**
   - Select "pontal-stock-frontend" project

3. **Go to Settings → Custom Domains**

4. **Add Custom Domain**
   - Enter your domain (e.g., pontal-stock.com)
   - Cloudflare will automatically configure DNS

5. **Verify Domain**
   - Wait for DNS propagation (usually 5-10 minutes)
   - Access your site at the custom domain

### Option 2: Use Existing Domain

If you already have a domain registered:

1. **Add Domain to Cloudflare**
   - Go to Cloudflare dashboard
   - Add your domain
   - Update nameservers at your registrar

2. **Configure Pages**
   - Go to Pages project settings
   - Add custom domain
   - Cloudflare handles SSL automatically

### Option 3: Temporary Workaround

If you want to test immediately without a custom domain:

1. **Use the main project domain**
   - https://pontal-stock-frontend.pages.dev
   - This may still show SSL warnings initially

2. **Wait for SSL Certificate**
   - Cloudflare automatically provisions SSL certificates
   - May take 5-15 minutes after first deployment

3. **Clear Browser Cache**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
   - Clear cookies for the domain
   - Try again

## Backend Connection

Your backend is already operational at:
- **URL**: https://gastronomos.hudsonargollo2.workers.dev
- **Status**: ✅ Working with proper SSL

The frontend needs to connect to this backend. Make sure the environment variable is set:

```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos.hudsonargollo2.workers.dev
```

## Testing Without Custom Domain

### Step 1: Wait for SSL Certificate
- Cloudflare typically provisions SSL within 5-15 minutes
- Check back in a few minutes

### Step 2: Try Different URLs
- Main domain: https://pontal-stock-frontend.pages.dev
- Temporary URL: https://30911c8a.pontal-stock-frontend.pages.dev

### Step 3: Clear Cache
- Hard refresh your browser
- Clear site data
- Try in incognito/private mode

## Recommended Next Steps

1. **Set up a custom domain** (best for production)
   - Provides professional URL
   - Automatic SSL certificate
   - Better branding

2. **Or wait for SSL provisioning** (5-15 minutes)
   - Cloudflare automatically provisions certificates
   - No additional configuration needed

3. **Test with demo credentials**
   - Email: demo@pontal-stock.com
   - Password: demo123
   - Tenant: pontal-carapitangui

## Deployment Details

### Project Information
- **Project Name**: pontal-stock-frontend
- **Deployment ID**: 30911c8a-5594-4cf6-bcc4-67d5daa8ffae
- **Environment**: Production
- **Branch**: main
- **Source Commit**: 4d17aa5
- **Deployed**: 3 minutes ago

### Build Information
- **Framework**: Next.js 15.1.0
- **Build Output**: Static (out/)
- **Files Deployed**: 114
- **Build Size**: ~2.5MB

### Configuration
- **Build Output Directory**: out/
- **Compatibility Date**: 2024-01-01
- **Environment**: production

## Cloudflare Dashboard

Access your deployment details:
- **Dashboard**: https://dash.cloudflare.com/cb27e1a67198789eb42d11ab90737652/pages/view/pontal-stock-frontend

## Support

If you continue to experience SSL issues:

1. **Check Cloudflare Status**
   - https://www.cloudflarestatus.com

2. **Review Deployment Logs**
   - Go to Cloudflare dashboard
   - Check deployment logs for errors

3. **Try Different Browser**
   - Test in Chrome, Firefox, Safari
   - Some browsers cache SSL errors

4. **Contact Cloudflare Support**
   - https://support.cloudflare.com

## Summary

Your Pontal Stock system is deployed and ready. The SSL error is temporary and will resolve once:
- SSL certificate is provisioned (automatic, 5-15 minutes)
- Or you set up a custom domain (recommended)

**Next Action**: Either wait 5-15 minutes for SSL provisioning, or set up a custom domain for production use.
