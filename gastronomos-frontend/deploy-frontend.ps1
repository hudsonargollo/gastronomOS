#!/usr/bin/env pwsh
# Frontend Deployment Script for GastronomOS

Write-Host "🚀 GastronomOS Frontend Deployment" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found!" -ForegroundColor Red
    Write-Host "Please run this script from the gastronomos-frontend directory" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed!" -ForegroundColor Red
        exit 1
    }
}

# Verify environment file
Write-Host "🔍 Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env.production") {
    $envContent = Get-Content ".env.production" -Raw
    if ($envContent -match "gastronomos-production.hudsonargollo2.workers.dev") {
        Write-Host "✅ Environment configured correctly" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Warning: .env.production may not have correct API URL" -ForegroundColor Yellow
        Write-Host "Expected: https://gastronomos-production.hudsonargollo2.workers.dev/api/v1" -ForegroundColor Gray
    }
} else {
    Write-Host "⚠️  Warning: .env.production not found" -ForegroundColor Yellow
}

Write-Host ""

# Clean previous build
if (Test-Path ".next") {
    Write-Host "🧹 Cleaning previous build..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".next"
}

if (Test-Path "out") {
    Write-Host "🧹 Cleaning previous output..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "out"
}

Write-Host ""

# Build
Write-Host "🔨 Building frontend..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "✅ Build completed successfully!" -ForegroundColor Green
Write-Host ""

# Check if out directory was created
if (-not (Test-Path "out")) {
    Write-Host "❌ Error: 'out' directory not found after build!" -ForegroundColor Red
    Write-Host "Make sure next.config.js has 'output: export'" -ForegroundColor Yellow
    exit 1
}

# Deploy
Write-Host "🚀 Deploying to Cloudflare Pages..." -ForegroundColor Yellow
Write-Host ""

npx wrangler pages deploy out --project-name=gastronomos-frontend

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common issues:" -ForegroundColor Yellow
    Write-Host "1. Not logged in - Run: npx wrangler login" -ForegroundColor Gray
    Write-Host "2. Project doesn't exist - Create it in Cloudflare Dashboard" -ForegroundColor Gray
    Write-Host "3. Wrong project name - Check your Cloudflare Pages project name" -ForegroundColor Gray
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to: https://gastronomos-frontend.pages.dev" -ForegroundColor White
Write-Host "2. Click Load Demo Credentials button" -ForegroundColor White
Write-Host "3. Should auto-login! 🎉" -ForegroundColor White
Write-Host ""
Write-Host "Demo Credentials:" -ForegroundColor Cyan
Write-Host "  Email:    demo@gastronomos.com" -ForegroundColor White
Write-Host "  Password: demo123" -ForegroundColor White
Write-Host ""
