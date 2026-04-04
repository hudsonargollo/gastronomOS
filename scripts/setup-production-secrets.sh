#!/bin/bash

# Production Secrets Setup Script
# This script helps set up all required secrets for production deployment

set -e

echo "=========================================="
echo "GastronomOS Production Secrets Setup"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI is not installed."
    echo "   Run: npm install -g wrangler"
    exit 1
fi

# Check if user is authenticated
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not authenticated with Cloudflare."
    echo "   Run: wrangler login"
    exit 1
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Required secrets
SECRETS=(
    "JWT_SECRET:JWT secret (minimum 64 characters)"
    "PAYMENT_ENCRYPTION_KEY:Payment encryption key (32+ characters)"
    "MERCADO_PAGO_ACCESS_TOKEN:Mercado Pago access token"
    "MERCADO_PAGO_PUBLIC_KEY:Mercado Pago public key"
)

# Optional secrets
OPTIONAL_SECRETS=(
    "ADMIN_API_KEY:Admin API key"
    "DATABASE_ENCRYPTION_KEY:Database encryption key"
    "WEBHOOK_SECRET:Webhook secret"
)

echo "Setting up REQUIRED secrets..."
echo "----------------------------------------"

for secret_info in "${SECRETS[@]}"; do
    IFS=':' read -r secret_name secret_desc <<< "$secret_info"
    
    echo ""
    echo "Secret: $secret_name"
    echo "Description: $secret_desc"
    echo ""
    read -p "Enter value for $secret_name (or press Enter to skip): " secret_value
    
    if [ -n "$secret_value" ]; then
        echo "$secret_value" | wrangler secret put "$secret_name" --env production
        echo "✅ $secret_name set successfully"
    else
        echo "⚠️  Skipped $secret_name"
    fi
done

echo ""
echo "Setting up OPTIONAL secrets..."
echo "----------------------------------------"

for secret_info in "${OPTIONAL_SECRETS[@]}"; do
    IFS=':' read -r secret_name secret_desc <<< "$secret_info"
    
    echo ""
    echo "Secret: $secret_name (optional)"
    echo "Description: $secret_desc"
    echo ""
    read -p "Enter value for $secret_name (or press Enter to skip): " secret_value
    
    if [ -n "$secret_value" ]; then
        echo "$secret_value" | wrangler secret put "$secret_name" --env production
        echo "✅ $secret_name set successfully"
    else
        echo "⚠️  Skipped $secret_name"
    fi
done

echo ""
echo "=========================================="
echo "Secrets setup complete!"
echo "=========================================="
echo ""
echo "To verify secrets are set:"
echo "  wrangler secret list --env production"
echo ""
echo "To deploy to production:"
echo "  npm run deploy:prod"