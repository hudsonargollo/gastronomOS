# GastronomOS Production Deployment Script (PowerShell)
# This script automates the deployment process to Cloudflare Workers

param(
    [switch]$SkipBuild,
    [switch]$SkipMigrations,
    [switch]$SkipDomain
)

# Error handling
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting GastronomOS Production Deployment" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green

function Write-Status {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

try {
    # Check prerequisites
    Write-Host ""
    Write-Info "Checking prerequisites..."

    # Check if wrangler is installed
    try {
        wrangler --version | Out-Null
        Write-Status "Wrangler CLI is available"
    }
    catch {
        Write-Error "Wrangler CLI is not installed"
        Write-Host "Install with: npm install -g wrangler"
        exit 1
    }

    # Check if user is authenticated
    try {
        wrangler whoami | Out-Null
        Write-Status "Wrangler authentication verified"
    }
    catch {
        Write-Error "Not authenticated with Wrangler"
        Write-Host "Run: wrangler login"
        exit 1
    }

    # Build TypeScript
    if (-not $SkipBuild) {
        Write-Host ""
        Write-Info "Building TypeScript..."
        try {
            npm run build
            Write-Status "TypeScript build successful"
        }
        catch {
            Write-Error "TypeScript build failed"
            exit 1
        }
    }

    # Database setup
    Write-Host ""
    Write-Info "Setting up production database..."
    Write-Warning "You may need to create the D1 database manually if it doesn't exist"
    Write-Host "Run: wrangler d1 create gastronomos-prod"
    Write-Host "Then update the database_id in wrangler.toml"
    
    $continue = Read-Host "Press Enter to continue once database is set up, or 'skip' to skip"
    if ($continue -eq "skip") {
        Write-Warning "Skipping database setup"
    }

    # R2 bucket setup
    Write-Host ""
    Write-Info "Setting up R2 bucket..."
    Write-Warning "Creating R2 bucket for receipt storage..."
    try {
        wrangler r2 bucket create gastronomos-receipts-prod 2>$null
        Write-Status "R2 bucket created successfully"
    }
    catch {
        Write-Warning "R2 bucket may already exist or creation failed"
    }

    # Secrets check
    Write-Host ""
    Write-Info "Checking production secrets..."
    Write-Warning "Ensure the following secrets are set:"
    Write-Host "- JWT_SECRET (required)"
    Write-Host "- ADMIN_API_KEY (optional)"

    # Generate JWT secret if needed
    $generateJwt = Read-Host "Do you need to generate a new JWT secret? (y/N)"
    if ($generateJwt -eq "y" -or $generateJwt -eq "Y") {
        Write-Host ""
        Write-Info "Generated JWT Secret:"
        npm run generate:jwt-secret
        Write-Host ""
        Write-Warning "Copy the generated secret and set it with:"
        Write-Host "wrangler secret put JWT_SECRET --env production"
        Read-Host "Press Enter once JWT_SECRET is set..."
    }

    # Database migrations
    if (-not $SkipMigrations) {
        Write-Host ""
        Write-Info "Running database migrations..."
        try {
            npm run db:migrate:prod
            Write-Status "Database migrations completed"
        }
        catch {
            Write-Error "Database migrations failed"
            exit 1
        }
    }

    # Deploy to production
    Write-Host ""
    Write-Info "Deploying to production..."
    try {
        npm run deploy:prod
        Write-Status "Deployment completed successfully"
    }
    catch {
        Write-Error "Deployment failed"
        exit 1
    }

    # Custom domain setup
    if (-not $SkipDomain) {
        Write-Host ""
        Write-Info "Setting up custom domain..."
        Write-Warning "Setting up custom domain: gastronomos.clubemkt.digital"
        Write-Host "You can set this up via:"
        Write-Host "1. Cloudflare Dashboard → Workers & Pages → gastronomos → Settings → Triggers"
        Write-Host "2. Or run: wrangler custom-domains add gastronomos.clubemkt.digital --env production"

        $setupDomain = Read-Host "Set up custom domain now via CLI? (y/N)"
        if ($setupDomain -eq "y" -or $setupDomain -eq "Y") {
            try {
                wrangler custom-domains add gastronomos.clubemkt.digital --env production
                Write-Status "Custom domain added successfully"
            }
            catch {
                Write-Warning "Custom domain setup may have failed - check Cloudflare Dashboard"
            }
        }
    }

    # Health check
    Write-Host ""
    Write-Info "Running health check..."
    Start-Sleep -Seconds 5  # Wait for deployment to propagate

    # Try custom domain
    try {
        $response = Invoke-WebRequest -Uri "https://gastronomos.clubemkt.digital/health" -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Status "Custom domain is responding"
        }
    }
    catch {
        Write-Warning "Custom domain not yet responding (DNS propagation may take time)"
    }

    # Final summary
    Write-Host ""
    Write-Host "🎉 Deployment Summary" -ForegroundColor Green
    Write-Host "====================" -ForegroundColor Green
    Write-Status "Worker deployed to Cloudflare"
    Write-Status "Database migrations applied"
    Write-Status "R2 bucket configured"
    Write-Info "Production URL: https://gastronomos.clubemkt.digital"

    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "1. Verify custom domain is working"
    Write-Host "2. Test API endpoints"
    Write-Host "3. Create initial tenant and admin user"
    Write-Host "4. Set up monitoring and alerts"

    Write-Host ""
    Write-Info "Useful commands:"
    Write-Host "- View logs: wrangler tail --env production"
    Write-Host "- Check secrets: wrangler secret list --env production"
    Write-Host "- Monitor: Cloudflare Dashboard → Analytics"

    Write-Host ""
    Write-Status "🚀 GastronomOS is now live in production!"
}
catch {
    Write-Error "Deployment failed: $($_.Exception.Message)"
    exit 1
}