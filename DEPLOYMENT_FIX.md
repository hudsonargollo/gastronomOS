# Frontend Deployment Fix

## Problem
The frontend at gastronomos.clubemkt.digital is showing only icons because it's trying to connect to `localhost:8787` instead of the production API at `api.gastronomos.clubemkt.digital`.

## Solution

### 1. Environment Configuration
I've created two environment files:

- `.env.production` - For production builds (Points to https://api.gastronomos.clubemkt.digital)
- `.env.local` - For local development (Points to http://localhost:8787)

### 2. Rebuild and Redeploy Frontend

Run these commands to rebuild and redeploy:

```bash
# Navigate to frontend directory
cd gastronomos-frontend

# Build with production environment
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

### 3. Alternative: Set Environment Variable in Cloudflare Pages

If you prefer to set the environment variable directly in Cloudflare Pages:

1. Go to Cloudflare Dashboard
2. Navigate to Pages > gastronomos-frontend
3. Go to Settings > Environment Variables
4. Add a new variable:
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: `https://api.gastronomos.clubemkt.digital/api/v1`
   - **Environment**: Production
5. Redeploy the site

### 4. Verify the Fix

After redeployment:

1. Visit https://gastronomos.clubemkt.digital
2. Open browser DevTools (F12)
3. Go to Network tab
4. Try to log in with demo credentials
5. Check that API requests are going to `api.gastronomos.clubemkt.digital` instead of `localhost`

### 5. Test Demo Login

1. Click "Try Demo" button
2. Credentials should load from the production API
3. Click "Sign In"
4. You should be redirected to the dashboard with proper content

## Additional Notes

### CORS Configuration
Make sure the backend API at `api.gastronomos.clubemkt.digital` has CORS configured to allow requests from `gastronomos.clubemkt.digital`.

The backend already has this configuration in `src/index.ts`:
```typescript
app.use('*', cors({
  origin: [
    'http://localhost:3000', 
    'https://app.gastronomos.com',
    'https://gastronomos.clubemkt.digital',
    // ... other origins
  ],
  // ...
}));
```

### Demo Data Initialization
Make sure the demo data is initialized in the production database:

```bash
# Check demo status
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/status

# Initialize demo data if needed
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/demo/initialize
```

### Troubleshooting

If the issue persists after redeployment:

1. **Clear browser cache** - The old build might be cached
2. **Check API health** - Visit https://api.gastronomos.clubemkt.digital/health
3. **Check demo credentials** - Visit https://api.gastronomos.clubemkt.digital/api/v1/demo/credentials
4. **Check browser console** - Look for CORS errors or API connection errors
5. **Verify environment variable** - Check that `NEXT_PUBLIC_API_BASE_URL` is set correctly in the build

### Quick Test Commands

```bash
# Test API health
curl https://api.gastronomos.clubemkt.digital/health

# Test demo credentials endpoint
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/credentials

# Test login (should fail without proper credentials, but shows API is working)
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gastronomos.com","password":"demo123"}'
```

## Expected Result

After fixing and redeploying, you should see:
- Full dashboard with stats, quick actions, and activity feed
- Proper navigation and layout
- Working demo button that loads credentials
- Successful authentication and data loading
