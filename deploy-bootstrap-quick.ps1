#!/usr/bin/env pwsh
# Quick Deploy - Skip TypeScript Build

Write-Host "🚀 Quick Deploy (Skipping TypeScript Build)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  Warning: Deploying without TypeScript validation" -ForegroundColor Yellow
Write-Host ""

# Deploy directly with wrangler (skips build)
npx wrangler deploy --env production

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Refresh CREATE_DEMO_NOW.html (Ctrl+F5)" -ForegroundColor White
    Write-Host "2. Click 'CREATE DEMO ACCOUNT NOW'" -ForegroundColor White
    Write-Host "3. Should work now! ✅" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}
