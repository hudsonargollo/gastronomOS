# 🚀 Frontend Deployment Guide

## Prerequisites
✅ Demo account created (use CREATE_DEMO_NOW.html in root folder)

## Quick Deploy (2 Commands)

### 1. Build
```powershell
npm run build
```

### 2. Deploy
```powershell
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

## What Changed

### Environment Files
Both `.env.local` and `.env.production` now point to:
```
https://gastronomos-production.hudsonargollo2.workers.dev/api/v1
```

This is the working workers.dev URL (custom domain has SSL issues).

### Demo Login Button
The "Load Demo Credentials" button now:
- Auto-fills email and password
- Auto-submits the login form
- Shows proper error messages

### Registration Page
New page at `/register` with:
- Full registration form
- Demo credentials quick-fill
- Link from login page

## After Deployment

### Test Demo Login
1. Go to https://gastronomos-frontend.pages.dev
2. Click "Load Demo Credentials"
3. Should auto-login! 🎉

### Test Registration
1. Go to https://gastronomos-frontend.pages.dev/register
2. Fill form or click "Fill Demo Credentials"
3. Create account

## Troubleshooting

### Build fails
```powershell
# Clear cache and rebuild
rm -rf .next
npm run build
```

### Deploy fails
```powershell
# Check if logged in
npx wrangler whoami

# Login if needed
npx wrangler login
```

### API connection fails
Check that .env.production has:
```
NEXT_PUBLIC_API_BASE_URL=https://gastronomos-production.hudsonargollo2.workers.dev/api/v1
```

## Deployment Checklist

- [ ] Demo account created (via CREATE_DEMO_NOW.html)
- [ ] Environment files updated (already done ✅)
- [ ] Build completes without errors
- [ ] Deploy completes successfully
- [ ] Login page loads
- [ ] Demo button works
- [ ] Dashboard loads after login

## Success!

If all steps work, you should see:
- ✅ Login page at root URL
- ✅ Demo button auto-logs in
- ✅ Dashboard shows with data
- ✅ Registration page at /register

---

**Time**: ~2 minutes  
**Commands**: 2  
**Difficulty**: Easy
