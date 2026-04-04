# ✅ Updated Demo Credentials

## What Changed

The backend requires:
1. Password must be at least 8 characters (was 6)
2. User must have a role (ADMIN, MANAGER, or STAFF)
3. Tenant must exist before creating user
4. Login requires tenantSlug parameter

## New Demo Credentials

```
Email:    demo@gastronomos.com
Password: demo123456  (changed from demo123)
Role:     ADMIN
Tenant:   Demo Restaurant
Slug:     demo-restaurant
```

## Files Updated

### Backend
- No changes needed (already correct)

### Frontend
- ✅ `gastronomos-frontend/src/lib/api.ts` - Updated login/register methods
- ✅ `gastronomos-frontend/src/app/page.tsx` - Updated demo login
- ✅ `gastronomos-frontend/src/app/register/page.tsx` - Updated registration flow

### Tools
- ✅ `CREATE_DEMO_NOW.html` - Updated to create tenant first, then user

### Documentation
- ✅ All .md files updated with new password

## How CREATE_DEMO_NOW.html Works Now

1. **Step 1**: Creates tenant "Demo Restaurant" with slug "demo-restaurant"
2. **Step 2**: Creates user with:
   - Email: demo@gastronomos.com
   - Password: demo123456
   - Role: ADMIN
   - TenantSlug: demo-restaurant

## Next Steps

1. **Refresh CREATE_DEMO_NOW.html in your browser** (Ctrl+F5)
2. **Click "CREATE DEMO ACCOUNT NOW"** button
3. Should work now! ✅

## If It Still Fails

Check the error message:
- **"Tenant not found"** → Tenant creation failed, check backend logs
- **"User already exists"** → Good! Account exists, proceed to deploy frontend
- **"Validation Error"** → Check the specific validation message

## After Account Creation

1. Deploy frontend:
   ```powershell
   cd gastronomos-frontend
   .\deploy-frontend.ps1
   ```

2. Test login at https://gastronomos-frontend.pages.dev

3. Click "Load Demo Credentials" - should auto-login!

## Technical Details

### Why These Changes?

The backend auth endpoint (`src/routes/auth.ts`) requires:
- `registerSchema` validates password min 8 chars
- `registerSchema` requires role enum
- Registration looks up tenant by slug (must exist)
- Login requires tenantSlug to find the tenant

### Frontend Changes

The API client now:
- Sends `tenantSlug` with login requests
- Sends `role` with register requests
- Register page creates tenant before user

### Demo Login Flow

```
User clicks "Load Demo Credentials"
  ↓
Frontend calls apiClient.login(email, password, tenantSlug)
  ↓
Backend validates credentials
  ↓
Backend returns JWT token
  ↓
Frontend stores token and redirects to dashboard
```

## Troubleshooting

### CREATE_DEMO_NOW.html shows old password
- Hard refresh: Ctrl+Shift+F5
- Or close and reopen the file

### Frontend still uses old password
- Rebuild: `npm run build`
- Clear browser cache
- Hard refresh: Ctrl+Shift+R

### Backend rejects password
- Check it's at least 8 characters
- Current password: demo123456 (10 characters) ✅

---

**Status**: ✅ All files updated  
**Password**: demo123456 (8+ characters)  
**Ready**: Yes, try CREATE_DEMO_NOW.html again!
