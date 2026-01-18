# GastronomOS Frontend Deployment Script
Write-Host "Building GastronomOS Frontend..." -ForegroundColor Green

# Build the application
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

# Copy additional files to out directory
Copy-Item "_headers" "out/_headers" -ErrorAction SilentlyContinue
Copy-Item "_redirects" "out/_redirects" -ErrorAction SilentlyContinue

Write-Host "Build completed successfully!" -ForegroundColor Green
Write-Host "Static files are in the 'out' directory" -ForegroundColor Yellow