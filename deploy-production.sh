#!/bin/bash

# GastronomOS Production Deployment Script
# This script deploys both backend and frontend to production

set -e  # Exit on error

echo "🚀 GastronomOS Production Deployment"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    print_error "Wrangler CLI not found. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Step 1: Deploy Backend
echo "📦 Step 1: Deploying Backend API..."
echo "-----------------------------------"

# Check if JWT_SECRET is set
echo "Checking JWT_SECRET..."
if wrangler secret list --env production 2>&1 | grep -q "JWT_SECRET"; then
    print_success "JWT_SECRET is configured"
else
    print_warning "JWT_SECRET not found. You'll need to set it:"
    echo "Run: npx wrangler secret put JWT_SECRET --env production"
    read -p "Do you want to continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy backend
echo "Deploying backend worker..."
if npx wrangler deploy --env production; then
    print_success "Backend deployed successfully"
    
    # Get the worker URL
    WORKER_URL=$(npx wrangler deployments list --env production 2>&1 | grep -o 'https://[^ ]*' | head -1)
    if [ -n "$WORKER_URL" ]; then
        echo "Worker URL: $WORKER_URL"
    fi
else
    print_error "Backend deployment failed"
    exit 1
fi

echo ""

# Step 2: Run Database Migrations
echo "🗄️  Step 2: Running Database Migrations..."
echo "-----------------------------------"

if npx wrangler d1 migrations apply gastronomos-prod --env production; then
    print_success "Database migrations applied"
else
    print_warning "Database migrations failed or already applied"
fi

echo ""

# Step 3: Initialize Demo Data
echo "🎭 Step 3: Initializing Demo Data..."
echo "-----------------------------------"

# Try to initialize demo data
API_URL="https://api.gastronomos.clubemkt.digital"
if curl -s -X POST "$API_URL/api/v1/demo/initialize" | grep -q "success"; then
    print_success "Demo data initialized"
else
    print_warning "Demo data initialization failed or already exists"
    echo "You can manually initialize it later with:"
    echo "curl -X POST $API_URL/api/v1/demo/initialize"
fi

echo ""

# Step 4: Deploy Frontend
echo "🎨 Step 4: Deploying Frontend..."
echo "-----------------------------------"

cd gastronomos-frontend

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    print_warning ".env.production not found. Creating it..."
    echo "NEXT_PUBLIC_API_BASE_URL=https://api.gastronomos.clubemkt.digital/api/v1" > .env.production
    print_success "Created .env.production"
fi

# Build frontend
echo "Building frontend..."
if npm run build; then
    print_success "Frontend built successfully"
else
    print_error "Frontend build failed"
    exit 1
fi

# Deploy to Cloudflare Pages
echo "Deploying to Cloudflare Pages..."
if npx wrangler pages deploy out --project-name=gastronomos-frontend; then
    print_success "Frontend deployed successfully"
else
    print_error "Frontend deployment failed"
    exit 1
fi

cd ..

echo ""
echo "✅ Deployment Complete!"
echo "======================="
echo ""
echo "🌐 Frontend: https://gastronomos.clubemkt.digital"
echo "🔌 Backend API: https://api.gastronomos.clubemkt.digital"
echo ""
echo "📋 Next Steps:"
echo "1. Configure custom domain for API in Cloudflare Dashboard"
echo "   Workers & Pages > gastronomos > Settings > Triggers > Custom Domains"
echo "   Add: api.gastronomos.clubemkt.digital"
echo ""
echo "2. Test the deployment:"
echo "   - Visit https://gastronomos.clubemkt.digital"
echo "   - Click 'Try Demo' button"
echo "   - Login with demo credentials"
echo ""
echo "3. Verify API health:"
echo "   curl https://api.gastronomos.clubemkt.digital/health"
echo ""
print_success "Deployment script completed!"
