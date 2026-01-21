# GastronomOS - Quick Reference Card

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | https://gastronomos.clubemkt.digital |
| **Frontend (Preview)** | https://a3facd51.gastronomos-frontend.pages.dev |
| **Backend API** | https://api.gastronomos.clubemkt.digital |
| **GitHub** | https://github.com/hudsonargollo/gastronomOS |

## 🔑 Demo Credentials

```
Email: demo@gastronomos.com
Password: demo123
```

## 🚀 Quick Deploy Commands

### Deploy Everything
```bash
./deploy-production.sh
```

### Deploy Backend Only
```bash
npx wrangler deploy --env production
```

### Deploy Frontend Only
```bash
cd gastronomos-frontend
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

## 🧪 Quick Test Commands

### Test API Health
```bash
curl https://api.gastronomos.clubemkt.digital/health
```

### Test Demo Credentials
```bash
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/credentials
```

### Initialize Demo Data
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/demo/initialize
```

### Test Login
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@gastronomos.com","password":"demo123"}'
```

## 📊 Monitoring Commands

### View Worker Logs
```bash
npx wrangler tail --env production
```

### List Deployments
```bash
# Backend
npx wrangler deployments list --env production

# Frontend
npx wrangler pages deployment list --project-name=gastronomos-frontend
```

### Check Secrets
```bash
npx wrangler secret list --env production
```

## 🗄️ Database Commands

### List Migrations
```bash
npx wrangler d1 migrations list gastronomos-prod --env production --remote
```

### Apply Migrations
```bash
npx wrangler d1 migrations apply gastronomos-prod --env production --remote
```

### Query Database
```bash
npx wrangler d1 execute gastronomos-prod --env production --remote \
  --command "SELECT * FROM tenants LIMIT 5"
```

## 🔐 Secrets Management

### Set Secret
```bash
npx wrangler secret put SECRET_NAME --env production
```

### Delete Secret
```bash
npx wrangler secret delete SECRET_NAME --env production
```

## 📝 Git Commands

### Commit and Push
```bash
git add .
git commit -m "your message"
git push origin main
```

### Check Status
```bash
git status
git log --oneline -5
```

## 🛠️ Development Commands

### Start Local Backend
```bash
npm run dev
```

### Start Local Frontend
```bash
cd gastronomos-frontend
npm run dev
```

### Run Tests
```bash
# Backend
npm test

# Frontend
cd gastronomos-frontend
npm test
```

## 📚 Documentation Files

| File | Description |
|------|-------------|
| `DEPLOYMENT_COMPLETE.md` | Full deployment summary |
| `BACKEND_DEPLOYMENT_GUIDE.md` | Backend deployment guide |
| `DEPLOYMENT_FIX.md` | Production issue fix |
| `PRODUCTION_ISSUE_SUMMARY.md` | Issue analysis |
| `deploy-production.sh` | Automated deployment script |

## 🎯 Common Tasks

### Update Frontend
```bash
cd gastronomos-frontend
# Make changes
npm run build
npx wrangler pages deploy out --project-name=gastronomos-frontend
```

### Update Backend
```bash
# Make changes
npx wrangler deploy --env production
```

### Reset Demo Data
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/demo/reset
```

### Check Demo Status
```bash
curl https://api.gastronomos.clubemkt.digital/api/v1/demo/status
```

## ⚠️ Troubleshooting

### Frontend Shows Only Icons
**Wait 5-30 minutes for DNS propagation**

Check DNS:
```bash
nslookup api.gastronomos.clubemkt.digital
```

### API Not Responding
Check deployment:
```bash
npx wrangler deployments list --env production
```

View logs:
```bash
npx wrangler tail --env production
```

### CORS Errors
Verify domain in `src/index.ts` CORS configuration

### Demo Login Fails
Initialize demo data:
```bash
curl -X POST https://api.gastronomos.clubemkt.digital/api/v1/demo/initialize
```

## 🔗 Useful Links

- **Cloudflare Dashboard**: https://dash.cloudflare.com
- **Workers Dashboard**: https://dash.cloudflare.com/workers
- **Pages Dashboard**: https://dash.cloudflare.com/pages
- **D1 Dashboard**: https://dash.cloudflare.com/d1
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/

## 📞 Support

### Check Logs
```bash
# Worker logs
npx wrangler tail --env production

# Local logs
cat ~/.wrangler/logs/wrangler-*.log
```

### Get Help
```bash
npx wrangler --help
npx wrangler deploy --help
npx wrangler pages --help
```

---

**Last Updated**: 2026-01-21
**Version**: 1.0.0
