#!/bin/bash

# GastronomOS Production Deployment Script
# This script automates the deployment process to Cloudflare Workers

set -e  # Exit on any error

echo "🚀 Starting GastronomOS Production Deployment"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check prerequisites
echo ""
print_info "Checking prerequisites..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI is not installed"
    echo "Install with: npm install -g wrangler"
    exit 1
fi
print_status "Wrangler CLI is available"

# Check if user is authenticated
if ! wrangler whoami &> /dev/null; then
    print_error "Not authenticated with Wrangler"
    echo "Run: wrangler login"
    exit 1
fi
print_status "Wrangler authentication verified"

# Check if TypeScript builds
echo ""
print_info "Building TypeScript..."
if npm run build; then
    print_status "TypeScript build successful"
else
    print_error "TypeScript build failed"
    exit 1
fi

# Create production database if it doesn't exist
echo ""
print_info "Setting up production database..."
print_warning "You may need to create the D1 database manually if it doesn't exist"
echo "Run: wrangler d1 create gastronomos-prod"
echo "Then update the database_id in wrangler.toml"
read -p "Press Enter to continue once database is set up..."

# Create R2 bucket if it doesn't exist
echo ""
print_info "Setting up R2 bucket..."
print_warning "Creating R2 bucket for receipt storage..."
if wrangler r2 bucket create gastronomos-receipts-prod 2>/dev/null; then
    print_status "R2 bucket created successfully"
else
    print_warning "R2 bucket may already exist or creation failed"
fi

# Check secrets
echo ""
print_info "Checking production secrets..."
print_warning "Ensure the following secrets are set:"
echo "- JWT_SECRET (required)"
echo "- ADMIN_API_KEY (optional)"

# Generate JWT secret if needed
read -p "Do you need to generate a new JWT secret? (y/N): " generate_jwt
if [[ $generate_jwt =~ ^[Yy]$ ]]; then
    echo ""
    print_info "Generated JWT Secret:"
    npm run generate:jwt-secret
    echo ""
    print_warning "Copy the generated secret and set it with:"
    echo "wrangler secret put JWT_SECRET --env production"
    read -p "Press Enter once JWT_SECRET is set..."
fi

# Run database migrations
echo ""
print_info "Running database migrations..."
if npm run db:migrate:prod; then
    print_status "Database migrations completed"
else
    print_error "Database migrations failed"
    exit 1
fi

# Deploy to production
echo ""
print_info "Deploying to production..."
if npm run deploy:prod; then
    print_status "Deployment completed successfully"
else
    print_error "Deployment failed"
    exit 1
fi

# Set up custom domain
echo ""
print_info "Setting up custom domain..."
print_warning "Setting up custom domain: gastronomos.clubemkt.digital"
echo "You can set this up via:"
echo "1. Cloudflare Dashboard → Workers & Pages → gastronomos → Settings → Triggers"
echo "2. Or run: wrangler custom-domains add gastronomos.clubemkt.digital --env production"

read -p "Set up custom domain now via CLI? (y/N): " setup_domain
if [[ $setup_domain =~ ^[Yy]$ ]]; then
    if wrangler custom-domains add gastronomos.clubemkt.digital --env production; then
        print_status "Custom domain added successfully"
    else
        print_warning "Custom domain setup may have failed - check Cloudflare Dashboard"
    fi
fi

# Health check
echo ""
print_info "Running health check..."
sleep 5  # Wait for deployment to propagate

# Try worker URL first
WORKER_URL=$(wrangler deployments list --env production --json 2>/dev/null | head -1 | grep -o 'https://[^"]*' || echo "")
if [[ -n "$WORKER_URL" ]]; then
    if curl -s "$WORKER_URL/health" > /dev/null; then
        print_status "Worker is responding at $WORKER_URL"
    else
        print_warning "Worker health check failed"
    fi
fi

# Try custom domain
if curl -s "https://gastronomos.clubemkt.digital/health" > /dev/null 2>&1; then
    print_status "Custom domain is responding"
else
    print_warning "Custom domain not yet responding (DNS propagation may take time)"
fi

# Final summary
echo ""
echo "🎉 Deployment Summary"
echo "===================="
print_status "Worker deployed to Cloudflare"
print_status "Database migrations applied"
print_status "R2 bucket configured"
print_info "Production URL: https://gastronomos.clubemkt.digital"
print_info "Fallback URL: $WORKER_URL"

echo ""
print_info "Next steps:"
echo "1. Verify custom domain is working"
echo "2. Test API endpoints"
echo "3. Create initial tenant and admin user"
echo "4. Set up monitoring and alerts"

echo ""
print_info "Useful commands:"
echo "- View logs: wrangler tail --env production"
echo "- Check secrets: wrangler secret list --env production"
echo "- Monitor: Cloudflare Dashboard → Analytics"

echo ""
print_status "🚀 GastronomOS is now live in production!"