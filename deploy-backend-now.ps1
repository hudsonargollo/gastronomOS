#!/usr/bin/env pwsh
# Quick Backend Deployment Script

Write-Host "🚀 Deploying Backend to Production..." -ForegroundColor Cyan
Write-Host ""

# Deploy to production
npm run deploy:prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Backend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Refresh CREATE_DEMO_NOW.html in your browser (Ctrl+F5)" -ForegroundColor White
    Write-Host "2. Click 'CREATE DEMO ACCOUNT NOW' button" -ForegroundColor White
    Write-Host "3. Should work now! ✅" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor Yellow
    exit 1
}
