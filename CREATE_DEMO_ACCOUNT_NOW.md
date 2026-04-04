# 🚨 CREATE DEMO ACCOUNT - DO THIS NOW

## The Problem
The demo account doesn't exist in your database yet. That's why the "Testar Conta Demo" button fails.

## The Solution (Choose ONE method)

### Method 1: Use Postman/Insomnia (EASIEST) ⭐

1. **Open Postman or Insomnia**
2. **Create a new POST request**:
   - URL: `https://api.gastronomos.clubemkt.digital/api/v1/auth/register`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body (raw JSON):
   ```json
   {
     "email": "demo@gastronomos.com",
     "password": "demo123",
     "tenantName": "Demo Restaurant",
     "tenantSlug": "demo-restaurant"
   }
   ```
3. **Click Send**
4. **Done!** You should get a response with a token

### Method 2: Use Browser Console

1. **Open your frontend** in the browser: https://gastronomos-frontend.pages.dev
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Paste this code** and press Enter:

```javascript
fetch('https://api.gastronomos.clubemkt.digital/api/v1/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@gastronomos.com',
    password: 'demo123',
    tenantName: 'Demo Restaurant',
    tenantSlug: 'demo-restaurant'
  })
})
.then(r => r.json())
.then(d => console.log('✅ Demo account created!', d))
.catch(e => console.log('Error:', e));
```

### Method 3: Use the Registration Page (After deploying)

1. **Deploy the frontend** with the new registration page
2. **Go to**: https://your-frontend.pages.dev/register
3. **Click "Fill Demo Credentials"**
4. **Click "Create Account"**
5. **Done!**

## After Creating the Account

Once the demo account is created:

1. Go to the login page
2. Click "Testar Conta Demo"
3. It will automatically log you in
4. You'll be redirected to the dashboard

## Verify It Worked

Test the login:
```javascript
// In browser console
fetch('https://api.gastronomos.clubemkt.digital/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'demo@gastronomos.com',
    password: 'demo123'
  })
})
.then(r => r.json())
.then(d => console.log('✅ Login works!', d))
.catch(e => console.log('❌ Login failed:', e));
```

## What If It Says "User already exists"?

**That's GOOD!** It means the account is already created. Just use the demo login button.

## Current Status

- ✅ Frontend code fixed
- ✅ API URL corrected
- ✅ Demo button fixed
- ✅ Registration page created
- ✅ Toaster added to layout
- 🔴 **NEED TO DO**: Create demo account (use Method 1 or 2 above)
- 🔴 **NEED TO DO**: Deploy frontend

## Quick Test (Do this RIGHT NOW)

**Option A - Postman/Insomnia:**
1. Open Postman
2. POST to `https://api.gastronomos.clubemkt.digital/api/v1/auth/register`
3. Body: `{"email":"demo@gastronomos.com","password":"demo123","tenantName":"Demo Restaurant","tenantSlug":"demo-restaurant"}`
4. Send

**Option B - Browser Console:**
1. Open https://gastronomos-frontend.pages.dev
2. Press F12
3. Paste the fetch code from Method 2 above
4. Press Enter

---

**DO THIS NOW** - It takes 30 seconds! 🚀
